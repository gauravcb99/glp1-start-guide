// The five self-tests from CLAUDE.md "Analysis spec". They use the real analysisConfig; every
// test parameter (seeds, placebo offset, tolerance, false-pattern rate) comes from personaConfig.
import { describe, expect, it } from "vitest";
import { analysisConfig, type AnalysisConfig } from "@/config/analysis";
import { ConfigNotSetError } from "@/config/errors";
import { personaConfig } from "@/config/personas";
import { adjustValues } from "@/lib/analysis/adjust";
import { buildCycles } from "@/lib/analysis/cycles";
import { addDays } from "@/lib/analysis/dates";
import { computeLongView } from "@/lib/analysis/longView";
import { analyzeWeek, computeProfile } from "@/lib/analysis/profile";
import type { Metric } from "@/lib/analysis/types";
import { preDrugWeekdayMeans } from "@/lib/analysis/weekday";
import { generatePersona, weekdayIndex } from "@/lib/personas/generate";

const cfg = analysisConfig;
const personas = personaConfig.personas!;
const seed = personaConfig.seed!;
const testSeeds = personaConfig.testSeeds!;
const maxFalseRate = personaConfig.maxFalsePatternRate!;
const SLOW = 120_000;

describe("self-test: planted pattern", () => {
  it("recovers persona A's planted within-week profile within tolerance", () => {
    const planted = personas.A.plantedProfile;
    if (planted === "none") throw new Error("persona A needs a planted profile");
    const { rows, inputs } = generatePersona(personaConfig, "A", seed);

    for (const [metric, profile] of Object.entries(planted) as [Metric, number[]][]) {
      const tolerance = personaConfig.recoveryToleranceNoiseSdMultiple! * personaConfig.noiseSd![metric]!;
      const result = computeProfile(rows, inputs, metric, "adjusted", cfg);
      expect(result.status).toBe("ok");
      result.points.forEach((p, d) => {
        expect(Math.abs(p.estimate! - profile[d]), `${metric} d=${d}`).toBeLessThanOrEqual(tolerance);
      });
    }
  });
});

describe("self-test: null", () => {
  it(
    "persona B (no drug effect) reports a clear pattern no more often than maxFalsePatternRate",
    () => {
      let clear = 0;
      for (const s of testSeeds) {
        const { rows, inputs } = generatePersona(personaConfig, "B", s);
        if (analyzeWeek(rows, inputs, "adjusted", cfg).clearPattern) clear++;
      }
      console.info(`null false-pattern rate: ${clear}/${testSeeds.length}`);
      expect(clear / testSeeds.length).toBeLessThanOrEqual(maxFalseRate);
    },
    SLOW,
  );
});

describe("self-test: weekday trap", () => {
  const spec = personas.C;
  if (spec.weeklyHabit === "none") throw new Error("persona C needs a weekly habit");
  const habit = spec.weeklyHabit;
  const { rows, inputs } = generatePersona(personaConfig, "C", seed);

  // d of the habit's morning, from persona C's config and cfg.dayZeroRule.
  const habitMorning = (weekdayIndex(habit.night) + 1) % 7;
  const dayZeroWeekday = weekdayIndex(spec.injectionWeekday) + cfg.dayZeroRule![spec.injectionTime];
  const habitD = (((habitMorning - dayZeroWeekday) % 7) + 7) % 7;

  it("raw view: a clear pattern at the habit's morning for every habit metric", () => {
    const raw = analyzeWeek(rows, inputs, "raw", cfg);
    expect(raw.clearPattern).toBe(true);
    for (const metric of Object.keys(habit.effects) as Metric[]) {
      const profile = raw.profiles.find((p) => p.metric === metric)!;
      expect(profile.clearDays, metric).toContain(habitD);
    }
  });

  it("adjusted view: no clear pattern", () => {
    expect(analyzeWeek(rows, inputs, "adjusted", cfg).clearPattern).toBe(false);
  });
});

describe("self-test: placebo date", () => {
  it(
    "persona B's pre-drug data with a fake start date stays under maxFalsePatternRate",
    () => {
      let clear = 0;
      for (const s of testSeeds) {
        const { rows, inputs } = generatePersona(personaConfig, "B", s);
        const historyStart = addDays(inputs.firstDoseDate, -personaConfig.firstDoseOffsetDays!);
        const fakeStart = addDays(historyStart, 7 * personaConfig.placeboStartOffsetWeeks!);
        const preDrugRows = rows.filter((r) => r.date < inputs.firstDoseDate);
        const placeboInputs = {
          ...inputs,
          firstDoseDate: fakeStart,
          injectionWeekdays: [{ from: fakeStart, weekday: inputs.injectionWeekdays[0].weekday }],
          doseSteps: [],
        };
        const result = analyzeWeek(preDrugRows, placeboInputs, "adjusted", cfg);
        expect(result.profiles.every((p) => p.status === "ok")).toBe(true); // history covers both windows
        if (result.clearPattern) clear++;
      }
      console.info(`placebo false-pattern rate: ${clear}/${testSeeds.length}`);
      expect(clear / testSeeds.length).toBeLessThanOrEqual(maxFalseRate);
    },
    SLOW,
  );
});

describe("self-test: config guard", () => {
  const { rows, inputs } = generatePersona(personaConfig, "A", seed);
  const metric: Metric = "restingHr";
  const baseline = preDrugWeekdayMeans(rows, inputs, metric, cfg);
  const values = rows.map((r) => ({ date: r.date, value: r.restingHr }));

  const entryPoints: [string, (c: AnalysisConfig) => unknown, (keyof AnalysisConfig)[]][] = [
    [
      "preDrugWeekdayMeans",
      (c) => preDrugWeekdayMeans(rows, inputs, metric, c),
      ["preDrugWindow", "minPreDrugWeeksPerWeekday", "calibratingRule"],
    ],
    ["adjustValues", (c) => adjustValues(rows, metric, baseline, c), ["calibratingRule"]],
    [
      "buildCycles",
      (c) => buildCycles(values, inputs, c),
      [
        "dayZeroRule",
        "irregularCycleRule",
        "missedInjectionRule",
        "excludeWeeksAfterStart",
        "excludeWeeksAfterDoseStep",
        "minDaysPerCycle",
      ],
    ],
    [
      "computeProfile",
      (c) => computeProfile(rows, inputs, metric, "adjusted", c),
      [
        "uncertaintyMethod",
        "clearPatternRule",
        "minCycles",
        "metricsShown",
        "preDrugWindow",
        "minPreDrugWeeksPerWeekday",
        "calibratingRule",
        "dayZeroRule",
        "irregularCycleRule",
        "missedInjectionRule",
        "excludeWeeksAfterStart",
        "excludeWeeksAfterDoseStep",
        "minDaysPerCycle",
      ],
    ],
    ["analyzeWeek", (c) => analyzeWeek(rows, inputs, "adjusted", c), ["metricsShown", "uncertaintyMethod"]],
    [
      "computeLongView",
      (c) => computeLongView(rows, inputs, metric, c),
      ["rollingWindowDays", "rollingMinDays", "rollingAlignment", "preDrugWindow", "calibratingRule"],
    ],
  ];

  for (const [name, run, keys] of entryPoints) {
    it.each(keys)(`${name} throws ConfigNotSetError when %s is null`, (key) => {
      expect(() => run({ ...cfg, [key]: null })).toThrow(ConfigNotSetError);
    });
  }
});
