import { describe, expect, it } from "vitest";
import { ConfigNotSetError } from "@/config/errors";
import { personaConfig, type PersonaConfig, type PersonaId } from "@/config/personas";
import type { DailyRow } from "@/lib/analysis/types";
import { generatePersona, weekdayIndex } from "@/lib/personas/generate";

const DAY_MS = 24 * 60 * 60 * 1000;
const personas = personaConfig.personas!;
const seed = personaConfig.seed!;

/** Config copy with no noise and no missing days, so planted effects can be checked exactly. */
function noiseFree(): PersonaConfig {
  const noiseSd = Object.fromEntries(Object.keys(personaConfig.noiseSd!).map((m) => [m, 0]));
  return { ...personaConfig, noiseSd, missingDayRate: 0 };
}

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

describe("generatePersona", () => {
  it("is reproducible for a seed and changes with the seed", () => {
    expect(generatePersona(personaConfig, "A", seed)).toEqual(generatePersona(personaConfig, "A", seed));
    const other = generatePersona(personaConfig, "A", seed + 1);
    expect(other.rows[0].restingHr).not.toBe(generatePersona(personaConfig, "A", seed).rows[0].restingHr);
  });

  it.each(["A", "B", "C"] as PersonaId[])(
    "persona %s: first dose on the injection weekday, dose steps as configured",
    (id) => {
      const spec = personas[id];
      const { inputs, rows } = generatePersona(noiseFree(), id, seed);
      expect(rows).toHaveLength(personaConfig.historyDays!);
      expect(weekdayOf(inputs.firstDoseDate)).toBe(weekdayIndex(spec.injectionWeekday));
      expect(daysBetween(rows[0].date, inputs.firstDoseDate)).toBe(personaConfig.firstDoseOffsetDays);
      expect(inputs.injectionWeekdays).toEqual([
        { from: inputs.firstDoseDate, weekday: weekdayIndex(spec.injectionWeekday) },
      ]);
      expect(inputs.drug).toBe(spec.drug);
      expect(inputs.injectionTime).toBe(spec.injectionTime);
      expect(inputs.doseSteps.map((s) => s.mg)).toEqual(spec.doseSchedule.mg);
      inputs.doseSteps.forEach((step, i) => {
        expect(daysBetween(inputs.firstDoseDate, step.date)).toBe(i * spec.doseSchedule.everyWeeks * 7);
      });
    },
  );

  it("throws ConfigNotSetError for a null key", () => {
    for (const key of ["historyStartAnchor", "baselines", "noiseSd", "missingDayRate", "personas"] as const) {
      expect(() => generatePersona({ ...personaConfig, [key]: null }, "A", seed)).toThrow(ConfigNotSetError);
    }
  });

  it("rejects a planted profile that is not mean-zero", () => {
    const bad: PersonaConfig = {
      ...personaConfig,
      personas: {
        ...personas,
        A: { ...personas.A, plantedProfile: { restingHr: [1, 0, 0, 0, 0, 0, 0] } },
      },
    };
    expect(() => generatePersona(bad, "A", seed)).toThrow(/mean-zero/);
  });

  it("persona A: planted profile on the k-th wake-up after each dose, plus the resting HR ramp", () => {
    const spec = personas.A;
    if (spec.plantedProfile === "none" || spec.longRunRestingHr === "none") throw new Error("A needs effects");
    const { changeBpm, rampWeeks } = spec.longRunRestingHr;
    const baselines = personaConfig.baselines!;
    const { inputs, rows } = generatePersona(noiseFree(), "A", seed);

    for (const row of rows) {
      const since = daysBetween(inputs.firstDoseDate, row.date);
      const k = since >= 1 ? (since - 1) % 7 : null;
      const ramp = since >= 0 ? changeBpm * Math.min(1, since / (rampWeeks * 7)) : 0;
      const planted = k === null ? 0 : spec.plantedProfile.restingHr![k];
      expect(row.restingHr).toBeCloseTo(baselines.restingHr! + planted + ramp, 10);
      expect(row.hrvMs).toBeCloseTo(baselines.hrvMs! + (k === null ? 0 : spec.plantedProfile.hrvMs![k]), 10);
    }
  });

  it("persona C: habit shifts every Monday row, before and after the first dose, and nothing else", () => {
    const spec = personas.C;
    if (spec.weeklyHabit === "none") throw new Error("C needs a habit");
    const baselines = personaConfig.baselines!;
    const { inputs, rows } = generatePersona(noiseFree(), "C", seed);
    const mondays = rows.filter((r) => weekdayOf(r.date) === 1);
    expect(mondays.some((r) => r.date < inputs.firstDoseDate)).toBe(true);
    expect(mondays.some((r) => r.date > inputs.firstDoseDate)).toBe(true);

    for (const row of rows) {
      const habit = weekdayOf(row.date) === 1;
      for (const m of ["restingHr", "hrvMs", "recovery", "sleepPerformance"] as const) {
        const expected = baselines[m]! + (habit ? spec.weeklyHabit.effects[m] ?? 0 : 0);
        expect(row[m]).toBeCloseTo(expected, 10);
      }
    }
  });

  it("persona B: no effect at all", () => {
    const baselines = personaConfig.baselines!;
    for (const row of generatePersona(noiseFree(), "B", seed).rows) {
      expect(row.restingHr).toBe(baselines.restingHr);
      expect(row.hrvMs).toBe(baselines.hrvMs);
      expect(row.recovery).toBe(baselines.recovery);
      expect(row.sleepPerformance).toBe(baselines.sleepPerformance);
    }
  });

  it("clamps recovery and sleep performance to 0-100", () => {
    const loud: PersonaConfig = {
      ...personaConfig,
      noiseSd: { ...personaConfig.noiseSd, recovery: 80, sleepPerformance: 80 },
    };
    const values = generatePersona(loud, "B", seed).rows.flatMap((r: DailyRow) => [r.recovery!, r.sleepPerformance!]);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(100);
    expect(values).toContain(0);
    expect(values).toContain(100);
  });

  it("drops mornings at roughly the configured rate", () => {
    const n = personaConfig.historyDays!;
    const p = personaConfig.missingDayRate!;
    const sd = Math.sqrt(n * p * (1 - p));
    for (const id of ["A", "B", "C"] as PersonaId[]) {
      const missing = n - generatePersona(personaConfig, id, seed).rows.length;
      expect(Math.abs(missing - n * p)).toBeLessThan(3.3 * sd); // ~99.9% range
    }
  });

  it("leaves unconfigured metrics null and marks no row calibrating", () => {
    for (const row of generatePersona(personaConfig, "A", seed).rows) {
      expect(row.respiratoryRate).toBeNull();
      expect(row.skinTempC).toBeNull();
      expect(row.strain).toBeNull();
      expect(row.calibrating).toBe(false);
    }
  });
});
