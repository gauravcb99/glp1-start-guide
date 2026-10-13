import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { adjustValues } from "./adjust";
import { addDays } from "./dates";
import { metricValues, notImplemented } from "./rows";
import type { DailyRow, LongView, LongViewPoint, MemberInputs, Metric } from "./types";
import { preDrugWeekdayMeans, type PreDrugBaseline } from "./weekday";

/**
 * Step 7: trailing rolling mean of a_t from the first dose on, with dose steps marked.
 * Only post-dose days enter a window, so the line describes the time since starting.
 */
export function computeLongView(
  rows: DailyRow[],
  inputs: MemberInputs,
  metric: Metric,
  cfg: AnalysisConfig,
): LongView {
  const windowDays = requireConfig(cfg, "rollingWindowDays");
  const minDays = requireConfig(cfg, "rollingMinDays");
  const alignment = requireConfig(cfg, "rollingAlignment");
  if (alignment !== "trailing") throw notImplemented(`rollingAlignment "${alignment}"`);

  const doseSteps = inputs.doseSteps;
  const baseline = preDrugWeekdayMeans(rows, inputs, metric, cfg);
  if (baseline.status !== "ok") return { metric, status: "notEnoughPreDrugData", points: [], doseSteps };

  const firstDose = inputs.firstDoseDate;
  const values = metricValues(rows, metric, cfg);
  const lastDate = values.length > 0 ? values[values.length - 1].date : firstDose;
  const adjusted = adjustedBetween(rows, metric, baseline, cfg, firstDose, lastDate);
  const points = trailingMeans(adjusted, firstDose, lastDate, windowDays, minDays);
  return { metric, status: "ok", points, doseSteps };
}

/**
 * The muted "before first dose" segment: the same trailing rolling a_t, over the pre-drug
 * window only. Windows are clipped to the pre-drug window, so none crosses the first dose.
 */
export function computePreDrugView(
  rows: DailyRow[],
  inputs: MemberInputs,
  metric: Metric,
  cfg: AnalysisConfig,
): { metric: Metric; status: "ok" | "notEnoughPreDrugData"; points: LongViewPoint[] } {
  const windowDays = requireConfig(cfg, "rollingWindowDays");
  const minDays = requireConfig(cfg, "rollingMinDays");
  const alignment = requireConfig(cfg, "rollingAlignment");
  if (alignment !== "trailing") throw notImplemented(`rollingAlignment "${alignment}"`);

  const baseline = preDrugWeekdayMeans(rows, inputs, metric, cfg);
  if (baseline.status !== "ok") return { metric, status: "notEnoughPreDrugData", points: [] };

  const lastPreDrug = addDays(inputs.firstDoseDate, -1);
  const windowStart = addDays(inputs.firstDoseDate, -7 * baseline.weeks.length);
  const adjusted = adjustedBetween(rows, metric, baseline, cfg, windowStart, lastPreDrug);
  return { metric, status: "ok", points: trailingMeans(adjusted, windowStart, lastPreDrug, windowDays, minDays) };
}

/** a_t for dates in [from, to], keyed by date. */
function adjustedBetween(
  rows: DailyRow[],
  metric: Metric,
  baseline: PreDrugBaseline,
  cfg: AnalysisConfig,
  from: string,
  to: string,
): Map<string, number> {
  const adjusted = new Map<string, number>();
  for (const { date, value } of adjustValues(rows, metric, baseline, cfg)) {
    if (date >= from && date <= to && value !== null) adjusted.set(date, value);
  }
  return adjusted;
}

/** Trailing mean for each date in [from, to]; only values in the map (already clipped) count. */
function trailingMeans(
  values: Map<string, number>,
  from: string,
  to: string,
  windowDays: number,
  minDays: number,
): LongViewPoint[] {
  const points: LongViewPoint[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    let total = 0;
    let n = 0;
    for (let back = 0; back < windowDays; back++) {
      const value = values.get(addDays(date, -back));
      if (value !== undefined) {
        total += value;
        n++;
      }
    }
    points.push({ date, rollingAdjusted: n >= minDays ? total / n : null, n });
  }
  return points;
}
