import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import type { DailyRow, DayValue, Metric } from "./types";

/** Step 0: applies calibratingRule. */
export function usableRows(rows: DailyRow[], cfg: AnalysisConfig): DailyRow[] {
  const rule = requireConfig(cfg, "calibratingRule");
  return rule === "exclude" ? rows.filter((r) => !r.calibrating) : rows;
}

/** One metric's values, after calibratingRule, in date order. */
export function metricValues(rows: DailyRow[], metric: Metric, cfg: AnalysisConfig): DayValue[] {
  return usableRows(rows, cfg)
    .map((r) => ({ date: r.date, value: r[metric] }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function notImplemented(option: string): Error {
  return new Error(`Analysis option ${option} is not implemented; its meaning needs Prakhar's definition.`);
}
