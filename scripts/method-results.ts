// Generates src/data/methodResults.json for the Method page: the self-test results and the
// detectability table, computed with the real engine and config on synthetic personas.
// Deterministic (fixed seeds, no timestamps). Run: npm run method-results
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { analysisConfig as cfg } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { personaConfig } from "@/config/personas";
import { computeMde } from "@/lib/analysis/mde";
import { analyzeWeek, computeProfile } from "@/lib/analysis/profile";
import type { Metric } from "@/lib/analysis/types";
import { generatePersona, weekdayIndex } from "@/lib/personas/generate";
import { placeboCase } from "@/lib/personas/placebo";

const OUT = join("src", "data", "methodResults.json");

const seed = requireConfig(personaConfig, "seed");
const testSeeds = requireConfig(personaConfig, "testSeeds");
const noiseSd = requireConfig(personaConfig, "noiseSd");
const tolerance = requireConfig(personaConfig, "recoveryToleranceNoiseSdMultiple");
const maxFalsePatternRate = requireConfig(personaConfig, "maxFalsePatternRate");
const mdeSeeds = Array.from({ length: requireConfig(personaConfig, "mdeSeedCount") }, (_, i) => i + 1);
const personas = requireConfig(personaConfig, "personas");
const dayZeroRule = requireConfig(cfg, "dayZeroRule");

// Planted pattern: largest error per metric on persona A, as a multiple of that metric's noise SD.
const A = generatePersona(personaConfig, "A", seed);
const plantedProfile = personas.A.plantedProfile;
if (plantedProfile === "none") throw new Error("persona A needs a planted profile");
const planted = (Object.keys(plantedProfile) as Metric[]).map((metric) => {
  const profile = computeProfile(A.rows, A.inputs, metric, "adjusted", cfg);
  const maxError = Math.max(...profile.points.map((p, d) => Math.abs(p.estimate! - plantedProfile[metric]![d])));
  return { metric, maxErrorInNoiseSd: maxError / noiseSd[metric]!, toleranceInNoiseSd: tolerance };
});

// Null and placebo: share of seeds with any clear pattern.
const rate = (make: (s: number) => { rows: typeof A.rows; inputs: typeof A.inputs }) =>
  testSeeds.filter((s) => {
    const { rows, inputs } = make(s);
    return analyzeWeek(rows, inputs, "adjusted", cfg).clearPattern;
  }).length;
const nullClear = rate((s) => generatePersona(personaConfig, "B", s));
const placeboClear = rate((s) => placeboCase(personaConfig, "B", s));

// Weekday trap: persona C, raw vs adjusted, at the habit's morning.
const C = generatePersona(personaConfig, "C", seed);
const habit = personas.C.weeklyHabit;
if (habit === "none") throw new Error("persona C needs a weekly habit");
const dayZeroWeekday = weekdayIndex(personas.C.injectionWeekday) + dayZeroRule[personas.C.injectionTime];
const habitD = ((((weekdayIndex(habit.night) + 1) % 7) - dayZeroWeekday) % 7 + 7) % 7;
const raw = analyzeWeek(C.rows, C.inputs, "raw", cfg);
const adjusted = analyzeWeek(C.rows, C.inputs, "adjusted", cfg);

const mde = computeMde(personaConfig, cfg, mdeSeeds);

const results = {
  synthetic: true,
  seed,
  testSeedCount: testSeeds.length,
  maxFalsePatternRate,
  selfTests: {
    planted,
    null: { clear: nullClear, runs: testSeeds.length },
    placebo: { clear: placeboClear, runs: testSeeds.length },
    weekdayTrap: {
      habitD,
      rawClearAtHabitDay: raw.profiles
        .filter((p) => p.metric in habit.effects)
        .every((p) => p.clearDays.includes(habitD)),
      adjustedClear: adjusted.clearPattern,
    },
  },
  mde,
  config: cfg,
};

writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
console.log(
  `wrote ${OUT}: null ${nullClear}/${testSeeds.length}, placebo ${placeboClear}/${testSeeds.length}, trap d=${habitD}`,
);
