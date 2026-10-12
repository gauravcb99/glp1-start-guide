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

/** Pre-drug mean per metric per weekday; null where there is not enough pre-drug data. */
export type WeekdayMeans = Record<Metric, Record<Weekday, number | null>>;

/** Day-since-injection, 0-based. */
export type DaySinceInjection = number;

export type ProfilePoint = {
  d: DaySinceInjection;
  estimate: number;
  lower: number;
  upper: number;
};

export type Profile = {
  metric: Metric;
  view: "raw" | "adjusted";
  cycles: number;
  points: ProfilePoint[];
  clearPattern: boolean;
};

export type LongViewPoint = { date: string; rollingAdjusted: number | null };

export type LongView = {
  metric: Metric;
  points: LongViewPoint[];
  doseSteps: { date: string; mg: number }[];
};
