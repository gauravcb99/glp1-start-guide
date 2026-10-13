import { requireConfig } from "@/config/errors";
import type { PersonaConfig, PersonaId, PersonaSpec, WeekdayName } from "@/config/personas";
import type { DailyRow, MemberInputs, Metric, Weekday } from "@/lib/analysis/types";
import { mulberry32 } from "@/lib/random";

// Synthetic members, driven only by PersonaConfig. Pure and seeded: same inputs, same output.

export const WEEKDAY_NAMES: WeekdayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Fixed order so each seed draws noise in the same sequence. */
const METRIC_ORDER: Metric[] = [
  "restingHr",
  "hrvMs",
  "recovery",
  "sleepPerformance",
  "respiratoryRate",
  "skinTempC",
  "strain",
];

const PERCENT_METRICS: Metric[] = ["recovery", "sleepPerformance"];
const PERSONA_SALT: Record<PersonaId, number> = { A: 1, B: 2, C: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;

export type GeneratedPersona = { inputs: MemberInputs; rows: DailyRow[] };

export function generatePersona(cfg: PersonaConfig, id: PersonaId, seed: number): GeneratedPersona {
  const anchor = requireConfig(cfg, "historyStartAnchor");
  const historyDays = requireConfig(cfg, "historyDays");
  const firstDoseOffset = requireConfig(cfg, "firstDoseOffsetDays");
  const baselines = requireConfig(cfg, "baselines");
  const noiseSd = requireConfig(cfg, "noiseSd");
  const missingDayRate = requireConfig(cfg, "missingDayRate");
  const spec = requireConfig(cfg, "personas")[id];

  const metrics = METRIC_ORDER.filter((m) => baselines[m] !== undefined);
  for (const m of metrics) {
    if (noiseSd[m] === undefined) throw new Error(`personas: noiseSd missing for ${m}`);
  }
  assertMeanZero(spec);

  const injectionWeekday = weekdayIndex(spec.injectionWeekday);
  const startMs = firstOnOrAfter(Date.parse(`${anchor}T00:00:00Z`), injectionWeekday);
  const firstDoseMs = startMs + firstDoseOffset * DAY_MS;
  const habitMorning =
    spec.weeklyHabit === "none" ? null : ((weekdayIndex(spec.weeklyHabit.night) + 1) % 7) as Weekday;

  const rng = mulberry32((Math.imul(seed, 0x9e3779b1) ^ PERSONA_SALT[id]) >>> 0);
  const normal = () => {
    // Box–Muller; 1 - rng() keeps the log argument in (0, 1].
    const u1 = 1 - rng();
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const rows: DailyRow[] = [];
  for (let t = 0; t < historyDays; t++) {
    const ms = startMs + t * DAY_MS;
    const sinceDose = t - firstDoseOffset; // days since the first dose; < 0 before it
    // k = 0 is the first wake-up after a dose: the morning after the injection day.
    const k = sinceDose >= 1 ? (sinceDose - 1) % 7 : null;

    // Draw for every day, missing or not, so each day's noise doesn't depend on earlier gaps.
    const missing = rng() < missingDayRate;
    const values: Partial<Record<Metric, number>> = {};
    for (const m of metrics) {
      let v = baselines[m]! + noiseSd[m]! * normal();
      if (k !== null && spec.plantedProfile !== "none") v += spec.plantedProfile[m]?.[k] ?? 0;
      if (m === "restingHr" && spec.longRunRestingHr !== "none" && sinceDose >= 0) {
        const { changeBpm, rampWeeks } = spec.longRunRestingHr;
        v += changeBpm * Math.min(1, sinceDose / (rampWeeks * 7));
      }
      if (spec.weeklyHabit !== "none" && new Date(ms).getUTCDay() === habitMorning) {
        v += spec.weeklyHabit.effects[m] ?? 0;
      }
      if (PERCENT_METRICS.includes(m)) v = Math.min(100, Math.max(0, v));
      values[m] = v;
    }
    if (missing) continue;

    rows.push({
      date: ymd(ms),
      cycleId: `syn-${id}-${String(t + 1).padStart(4, "0")}`,
      restingHr: values.restingHr ?? null,
      hrvMs: values.hrvMs ?? null,
      recovery: values.recovery ?? null,
      sleepPerformance: values.sleepPerformance ?? null,
      respiratoryRate: values.respiratoryRate ?? null,
      skinTempC: values.skinTempC ?? null,
      strain: values.strain ?? null,
      calibrating: false,
    });
  }

  const lastMs = startMs + (historyDays - 1) * DAY_MS;
  const doseSteps = spec.doseSchedule.mg
    .map((mg, i) => ({ ms: firstDoseMs + i * spec.doseSchedule.everyWeeks * 7 * DAY_MS, mg }))
    .filter((step) => step.ms <= lastMs)
    .map((step) => ({ date: ymd(step.ms), mg: step.mg }));

  const inputs: MemberInputs = {
    drug: spec.drug,
    firstDoseDate: ymd(firstDoseMs),
    injectionWeekdays: [{ from: ymd(firstDoseMs), weekday: injectionWeekday }],
    missedInjectionDates: [],
    movedInjections: [],
    injectionTime: spec.injectionTime,
    doseSteps,
  };

  return { inputs, rows };
}

export function weekdayIndex(name: WeekdayName): Weekday {
  return WEEKDAY_NAMES.indexOf(name) as Weekday;
}

function assertMeanZero(spec: PersonaSpec): void {
  if (spec.plantedProfile === "none") return;
  for (const [metric, profile] of Object.entries(spec.plantedProfile)) {
    const mean = profile.reduce((a, b) => a + b, 0) / profile.length;
    if (Math.abs(mean) > 1e-9) throw new Error(`personas: plantedProfile.${metric} is not mean-zero`);
  }
}

function firstOnOrAfter(ms: number, weekday: Weekday): number {
  const shift = (weekday - new Date(ms).getUTCDay() + 7) % 7;
  return ms + shift * DAY_MS;
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
