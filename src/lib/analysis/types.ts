/** One row per wake morning. See "Daily row" in CLAUDE.md. */
export type DailyRow = {
  date: string; // local YYYY-MM-DD of the main sleep's END (wake morning), shifted by that sleep's timezone_offset
  cycleId: number | string;
  restingHr: number | null; // recovery.score.resting_heart_rate
  hrvMs: number | null; // recovery.score.hrv_rmssd_milli
  recovery: number | null; // recovery.score.recovery_score
  sleepPerformance: number | null;
  respiratoryRate: number | null;
  skinTempC: number | null;
  strain: number | null; // from the cycle that starts with this sleep
  calibrating: boolean;
};

export type Metric =
  | "restingHr"
  | "hrvMs"
  | "recovery"
  | "sleepPerformance"
  | "respiratoryRate"
  | "skinTempC"
  | "strain";

/** 0 = Sunday ... 6 = Saturday, matching Date.prototype.getUTCDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Drug = "semaglutide" | "tirzepatide";
export type InjectionTime = "morning" | "evening";

/** Member inputs, stored in localStorage. */
export type MemberInputs = {
  drug: Drug;
  firstDoseDate: string; // YYYY-MM-DD
  /** Injection weekday, with dated changes. The first entry starts at firstDoseDate. */
  injectionWeekdays: { from: string; weekday: Weekday }[];
  missedInjectionDates: string[];
  movedInjections: { scheduled: string; actual: string }[];
  injectionTime: InjectionTime;
  doseSteps: { date: string; mg: number }[];
};

/** A metric value on one wake morning. */
export type DayValue = { date: string; value: number | null };

/** Day-since-injection, 0-based. */
export type DaySinceInjection = number;

export type View = "raw" | "adjusted";

export type Interval = { lower: number; upper: number };

export type ProfileStatus = "ok" | "notEnoughPreDrugData" | "notEnoughCycles";

export type ProfilePoint = {
  d: DaySinceInjection;
  /** Mean of within-cycle centred values at d; null if no cycle has data at d. */
  estimate: number | null;
  /** Interval shown on screen, at uncertaintyMethod.level. */
  band: Interval | null;
  /** Interval used for the clear-pattern decision, at the corrected level. */
  decision: Interval | null;
  /** Standard error of the estimate. */
  se: number | null;
  /** t intervals only: variance from resampling cycles and from resampling pre-drug weeks (each scaled by n/(n − 1)). */
  variance: { cycles: number; preWeeks: number } | null;
  /** t intervals only: degrees of freedom used for the t quantile. */
  df: number | null;
};

export type Profile = {
  metric: Metric;
  view: View;
  status: ProfileStatus;
  /** Cycles that passed every rule; the unit of the bootstrap. */
  cycles: number;
  points: ProfilePoint[];
  /** Days whose decision interval excludes zero. */
  clearDays: DaySinceInjection[];
  clearPattern: boolean;
  bandLevel: number;
  decisionLevel: number;
  /** Bootstrap replicates discarded because a resampled weekday had no pre-drug data. */
  discardedResamples: number;
};

export type WeekAnalysis = {
  view: View;
  profiles: Profile[];
  /** True if any shown metric has a clear pattern. */
  clearPattern: boolean;
};

export type LongViewPoint = {
  date: string;
  /** Trailing mean of a_t, or null when the window has fewer than rollingMinDays valid days. */
  rollingAdjusted: number | null;
  /** Valid days in the window. */
  n: number;
};

export type LongView = {
  metric: Metric;
  status: "ok" | "notEnoughPreDrugData";
  points: LongViewPoint[];
  doseSteps: { date: string; mg: number }[];
};
