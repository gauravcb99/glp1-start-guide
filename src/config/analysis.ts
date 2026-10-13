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
  /**
   * Interval around P(d). Cycles are the unit either way.
   * interval: "percentile" uses percentiles of the joint bootstrap. The two t options build
   * estimate ± t × SE, where SE² = V_cycles + V_preWeeks (each from a bootstrap that resamples
   * only that unit) and the t degrees of freedom combine (cycles − 1) and (pre-drug weeks − 1)
   * by Welch–Satterthwaite ("tWelchSatterthwaite") or are min(cycles, pre-drug weeks) − 1
   * ("tMinDf"). See docs/methods-intervals.md.
   */
  uncertaintyMethod:
    | {
        kind: "bootstrapCycles";
        resamples: number;
        seed: number;
        level: number;
        interval: "percentile" | "tWelchSatterthwaite" | "tMinDf";
      }
    | { kind: "standardErrorCycles"; level: number }
    | null;
  /**
   * When the app says "clear pattern".
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
  /** Fewest valid days in a rolling window needed to show a value. */
  rollingMinDays: number | null;
  /** Rolling window alignment. trailing: the value on date t averages [t − (window − 1), t]. */
  rollingAlignment: "trailing" | "centered" | null;
  /** Days pulled from WHOOP. Must cover the pre-drug window plus the period since starting. */
  historyDaysToFetch: number | null;
};

// All values below set by Prakhar, 2026-10-12.
export const analysisConfig: AnalysisConfig = {
  preDrugWindow: { kind: "lastWeeks", weeks: 12 },
  minPreDrugWeeksPerWeekday: 6,
  minCycles: 6,
  excludeWeeksAfterStart: 0,
  excludeWeeksAfterDoseStep: 0,
  // d = 0 is the first wake-up after the dose, for both morning and evening injections.
  dayZeroRule: { morning: 1, evening: 1 },
  minDaysPerCycle: 5,
  irregularCycleRule: "drop",
  missedInjectionRule: "dropCycle",
  calibratingRule: "exclude",
  // The bootstrap resamples whole injection weeks AND pre-drug weeks, so the error in the
  // pre-drug weekday means (shared by every cycle, since d and weekday are aligned) is carried through.
  // interval chosen by Prakhar 2026-10-13, for both the 95% bands and the decision interval.
  // Percentile gave false-pattern rates of 14/100 (null) and 31/100 (placebo); Welch–Satterthwaite
  // reached the 0.10 limit at 8 placebo cycles, and the app allows as few as minCycles = 6.
  // A false "clear pattern" is worse than a missed one. Comparison: docs/methods-intervals.md.
  uncertaintyMethod: {
    kind: "bootstrapCycles",
    resamples: 10000,
    seed: 1,
    level: 0.95,
    interval: "tMinDf",
  },
  // Bonferroni across days and metrics: the "clear pattern" decision uses intervals at
  // level 1 - 0.05 / (7 × metricsShown.length), i.e. 1 - 0.05 / 28 ≈ 0.99821 with 4 metrics.
  // The displayed bands stay at uncertaintyMethod.level (95%).
  clearPatternRule: { minDaysIntervalExcludesZero: 1, correction: "acrossDaysAndMetrics" },
  metricsShown: ["restingHr", "hrvMs", "recovery", "sleepPerformance"],
  rollingWindowDays: 14,
  rollingMinDays: 10,
  rollingAlignment: "trailing",
  historyDaysToFetch: 365,
};
