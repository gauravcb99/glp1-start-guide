import type { Drug, InjectionTime, Metric } from "@/lib/analysis/types";

/** Seven values for d = 0..6. */
export type WeekProfile = [number, number, number, number, number, number, number];

/** Weekdays are named here; code converts with Date.getUTCDay() order (sunday = 0 ... saturday = 6). */
export type WeekdayName =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type PersonaId = "A" | "B" | "C";

/**
 * One synthetic member. "none" means the effect is deliberately absent
 * (null is reserved for "not set yet").
 */
export type PersonaSpec = {
  drug: Drug;
  injectionWeekday: WeekdayName;
  injectionTime: InjectionTime;
  /** Dose steps starting at the first dose: mg[i] begins i × everyWeeks weeks after it; the last dose is kept. */
  doseSchedule: { everyWeeks: number; mg: number[] };
  /** Planted within-week profile per metric, d = 0..6, each mean-zero. */
  plantedProfile: Partial<Record<Metric, WeekProfile>> | "none";
  /** Resting HR change after the first dose, rising linearly over rampWeeks, then flat. */
  longRunRestingHr: { changeBpm: number; rampWeeks: number } | "none";
  /** A habit on one night each week, shifting the next morning's row, before and after the first dose. */
  weeklyHabit: { night: WeekdayName; effects: Partial<Record<Metric, number>> } | "none";
};

/**
 * Synthetic persona generation and self-test parameters. All start as null.
 * Gaurav sets these; code must never pick a default. Use requireConfig().
 */
export type PersonaConfig = {
  /** Each persona's history starts on the first day on or after this date that falls on its injection weekday. */
  historyStartAnchor: string | null;
  /** Total days of history per persona; must cover the pre-drug window plus the placebo window. */
  historyDays: number | null;
  /** Days from the start of history to the first dose. */
  firstDoseOffsetDays: number | null;
  /** Mean level per metric before any effect. Recovery and sleep performance are clamped to 0-100. */
  baselines: Partial<Record<Metric, number>> | null;
  /** Standard deviation of independent daily noise per metric. */
  noiseSd: Partial<Record<Metric, number>> | null;
  /** Probability that a morning is missing entirely, at random. */
  missingDayRate: number | null;
  /** Seed for the committed persona files. */
  seed: number | null;
  /** Seeds used by the null and placebo self-tests. */
  testSeeds: number[] | null;
  /** Fake start date for the placebo test, in weeks after the start of history. */
  placeboStartOffsetWeeks: number | null;
  /** Highest acceptable rate of "clear pattern" on data with no drug effect. */
  maxFalsePatternRate: number | null;
  /** Allowed error per day when recovering persona A's profile on the main seed, as a multiple of that metric's noiseSd. */
  recoveryToleranceNoiseSdMultiple: number | null;
  /** Simulated persona-B runs behind the Method page's detectability table (seeds 1..N). */
  mdeSeedCount: number | null;
  personas: Record<PersonaId, PersonaSpec> | null;
};

// All values below set by Gaurav, 2026-10-12. They are synthetic and illustrative:
// chosen to exercise the analysis, not taken from any real member or trial.

const SEMAGLUTIDE_STEPS = { everyWeeks: 4, mg: [0.25, 0.5, 1, 1.7, 2.4] };

export const personaConfig: PersonaConfig = {
  historyStartAnchor: "2025-10-01",
  historyDays: 365,
  firstDoseOffsetDays: 154, // first dose at week 22
  baselines: { restingHr: 60, hrvMs: 55, recovery: 60, sleepPerformance: 80 },
  noiseSd: { restingHr: 3, hrvMs: 10, recovery: 12, sleepPerformance: 8 },
  missingDayRate: 0.03,
  seed: 42,
  testSeeds: Array.from({ length: 100 }, (_, i) => i + 1), // 1 to 100
  placeboStartOffsetWeeks: 14,
  maxFalsePatternRate: 0.1,
  recoveryToleranceNoiseSdMultiple: 1.0,
  mdeSeedCount: 2000, // set by Gaurav 2026-10-13: converged figure (100 runs read 8-26% high)
  personas: {
    // Planted pattern.
    A: {
      drug: "semaglutide",
      injectionWeekday: "wednesday",
      injectionTime: "morning",
      doseSchedule: SEMAGLUTIDE_STEPS,
      plantedProfile: {
        restingHr: [2, 5, 3, 0, -3, -3, -4],
        hrvMs: [-5, -15, -8, 0, 8, 10, 10],
        recovery: [-6, -18, -10, 0, 10, 12, 12],
        sleepPerformance: [0, 0, 0, 0, 0, 0, 0],
      },
      longRunRestingHr: { changeBpm: 3, rampWeeks: 16 },
      weeklyHabit: "none",
    },
    // No drug effect.
    B: {
      drug: "tirzepatide",
      injectionWeekday: "monday",
      injectionTime: "evening",
      doseSchedule: { everyWeeks: 4, mg: [2.5, 5, 7.5, 10, 12.5, 15] },
      plantedProfile: "none",
      longRunRestingHr: "none",
      weeklyHabit: "none",
    },
    // Weekday trap: a Sunday-night habit and no drug effect. With dayZeroRule.morning = 1,
    // Monday is d = 0, so the raw view should show a fake day-0 effect.
    C: {
      drug: "semaglutide",
      injectionWeekday: "sunday",
      injectionTime: "morning",
      doseSchedule: SEMAGLUTIDE_STEPS,
      plantedProfile: "none",
      longRunRestingHr: "none",
      weeklyHabit: {
        night: "sunday",
        effects: { restingHr: 5, hrvMs: -15, recovery: -18, sleepPerformance: -12 },
      },
    },
  },
};
