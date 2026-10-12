import type { AnalysisConfig } from "@/config/analysis";
import type { DailyRow, Metric, WeekdayMeans } from "./types";

export type AdjustedValue = { date: string; value: number | null };

/** a_t = x_t - preMean[weekday(t)] (Analysis spec step 2). */
export function adjustValues(
  _rows: DailyRow[],
  _metric: Metric,
  _means: WeekdayMeans,
  _cfg: AnalysisConfig,
): AdjustedValue[] {
  throw new Error("Not implemented: Phase 4");
}
