import type { Metric } from "@/lib/analysis/types";

/**
 * Every value that changes analysis results. All start as null.
 * Prakhar sets these; code must never pick a default. Use requireConfig().
 * Option meanings: see "Fill the config" in PROMPTS.md.
 */
export type AnalysisConfig = {
  /** Days before the first dose used for weekday means. */
  preDrugWindow: { kind: "all" } | { kind: "lastWeeks"; weeks: number } | null;
  /** Minimum pre-drug observations per weekday. */
  minPreDrugWeeksPerWeekday: number | null;
  /** Cycles needed before the week view appears. */
  minCycles: number | null;
  /** Weeks skipped right after the first dose. */
  excludeWeeksAfterStart: number | null;
  /** Weeks skipped after each dose step. */
  excludeWeeksAfterDoseStep: number | null;
  /** Offset in days from the injection date to the d = 0 morning, by injection time. */
  dayZeroRule: { morning: 0 | 1; evening: 0 | 1 } | null;
  /** Days with data needed for a cycle to count. */
  minDaysPerCycle: number | null;
  /** Cycles not 7 days long (weekday changes). */
  irregularCycleRule: "drop" | "keepActualLength" | null;
  /** What a missed dose does to cycles. */
  missedInjectionRule: "dropCycle" | "extendCycle" | null;
  /** WHOOP calibration days. */
  calibratingRule: "exclude" | "keep" | null;
  /** Interval around P(d). Cycles are the unit either way. */
  uncertaintyMethod:
    | { kind: "bootstrapCycles"; resamples: number; seed: number; level: number }
    | { kind: "standardErrorCycles"; level: number }
    | null;
  /**
   * When the app says "clear pattern". Shape is provisional; confirm before Phase 4.
   * correction: how the interval is widened for the number of days and metrics tested.
   */
  clearPatternRule: {
    minDaysIntervalExcludesZero: number;
    correction: "none" | "acrossDays" | "acrossDaysAndMetrics";
  } | null;
  /** Metrics in the week view. */
  metricsShown: Metric[] | null;
  /** Long-view smoothing. */
  rollingWindowDays: number | null;
  /** Days pulled from WHOOP. Must cover the pre-drug window plus the period since starting. */
  historyDaysToFetch: number | null;
};

export const analysisConfig: AnalysisConfig = {
  preDrugWindow: null,
  minPreDrugWeeksPerWeekday: null,
  minCycles: null,
  excludeWeeksAfterStart: null,
  excludeWeeksAfterDoseStep: null,
  dayZeroRule: null,
  minDaysPerCycle: null,
  irregularCycleRule: null,
  missedInjectionRule: null,
  calibratingRule: null,
  uncertaintyMethod: null,
  clearPatternRule: null,
  metricsShown: null,
  rollingWindowDays: null,
  historyDaysToFetch: null,
};
