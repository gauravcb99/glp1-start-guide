import type { AnalysisConfig } from "@/config/analysis";
import { weekdayOf } from "./dates";
import { metricValues } from "./rows";
import type { DailyRow, DayValue, Metric } from "./types";
import type { PreDrugBaseline } from "./weekday";

/** Step 2: a_t = x_t − pre-drug mean for that weekday. Requires an "ok" baseline. */
export function adjustValues(
  rows: DailyRow[],
  metric: Metric,
  baseline: PreDrugBaseline,
  cfg: AnalysisConfig,
): DayValue[] {
  if (baseline.status !== "ok") throw new Error("adjustValues needs enough pre-drug data");
  return metricValues(rows, metric, cfg).map(({ date, value }) => ({
    date,
    value: value === null ? null : value - baseline.means[weekdayOf(date)]!,
  }));
}
