import type { InjectionTime, Metric, Weekday } from "@/lib/analysis/types";

/** Seven values for d = 0..6. */
export type WeekProfile = [number, number, number, number, number, number, number];

/**
 * Synthetic persona generation and self-test parameters. All start as null.
 * Prakhar sets these; code must never pick a default. Use requireConfig().
 */
export type PersonaConfig = {
  /** Total days of history per persona; must cover the pre-drug window plus the placebo window. */
  historyDays: number | null;
  /** Days from the start of history to the first dose. */
  firstDoseOffsetDays: number | null;
  injectionWeekday: Weekday | null;
  injectionTime: InjectionTime | null;
  /** Persona A's planted within-week profile per metric, mean-zero over d = 0..6. */
  plantedProfile: Partial<Record<Metric, WeekProfile>> | null;
  /** Persona A's long-run resting HR change after starting, in bpm. */
  longRunRestingHrChangeBpm: number | null;
  /** Persona C's weekly habit: the night it happens and its effect per metric the next morning. */
  weeklyHabit: { night: Weekday; effects: Partial<Record<Metric, number>> } | null;
  /** Noise standard deviation per metric. */
  noiseSd: Partial<Record<Metric, number>> | null;
  /** Seed for the committed persona files. */
  seed: number | null;
  /** Seeds used by the null and placebo self-tests. */
  testSeeds: number[] | null;
  /** Fake start date for the placebo test, in weeks after the start of history. */
  placeboStartOffsetWeeks: number | null;
  /** Highest acceptable rate of "clear pattern" on data with no drug effect. */
  maxFalsePatternRate: number | null;
  /** Allowed error when recovering persona A's planted profile. */
  recoveryTolerance: number | null;
};

export const personaConfig: PersonaConfig = {
  historyDays: null,
  firstDoseOffsetDays: null,
  injectionWeekday: null,
  injectionTime: null,
  plantedProfile: null,
  longRunRestingHrChangeBpm: null,
  weeklyHabit: null,
  noiseSd: null,
  seed: null,
  testSeeds: null,
  placeboStartOffsetWeeks: null,
  maxFalsePatternRate: null,
  recoveryTolerance: null,
};
