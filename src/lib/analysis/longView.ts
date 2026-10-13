import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { adjustValues } from "./adjust";
import { addDays } from "./dates";
import { metricValues, notImplemented } from "./rows";
import type { DailyRow, LongView, LongViewPoint, MemberInputs, Metric } from "./types";
import { preDrugWeekdayMeans } from "./weekday";

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
  const adjusted = new Map<string, number>();
  for (const { date, value } of adjustValues(rows, metric, baseline, cfg)) {
    if (date >= firstDose && value !== null) adjusted.set(date, value);
  }

  const points: LongViewPoint[] = [];
  for (let date = firstDose; date <= lastDate; date = addDays(date, 1)) {
    let total = 0;
    let n = 0;
    for (let back = 0; back < windowDays; back++) {
      const value = adjusted.get(addDays(date, -back));
      if (value !== undefined) {
        total += value;
        n++;
      }
    }
    points.push({ date, rollingAdjusted: n >= minDays ? total / n : null, n });
  }

  return { metric, status: "ok", points, doseSteps };
}
