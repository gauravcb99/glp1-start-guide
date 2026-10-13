import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { addDays, daysBetween, weekdayOf } from "./dates";
import { metricValues } from "./rows";
import type { DailyRow, MemberInputs, Metric } from "./types";

export type PreDrugBaseline = {
  status: "ok" | "notEnoughPreDrugData";
  /** Mean per weekday (index 0 = Sunday); null when a weekday has no pre-drug data. */
  means: (number | null)[];
  counts: number[];
  /**
   * 7-day blocks counted back from the first dose (weeks[0] ends the day before it).
   * Each block holds at most one value per weekday; the bootstrap resamples whole blocks.
   */
  weeks: (number | null)[][];
};

/** Step 1: pre-drug mean for each weekday over cfg.preDrugWindow. */
export function preDrugWeekdayMeans(
  rows: DailyRow[],
  inputs: MemberInputs,
  metric: Metric,
  cfg: AnalysisConfig,
): PreDrugBaseline {
  const window = requireConfig(cfg, "preDrugWindow");
  const minPerWeekday = requireConfig(cfg, "minPreDrugWeeksPerWeekday");
  const values = metricValues(rows, metric, cfg);

  const firstDose = inputs.firstDoseDate;
  const before = values.filter((v) => v.date < firstDose);
  const weekCount =
    window.kind === "lastWeeks"
      ? window.weeks
      : before.length === 0
        ? 0
        : Math.ceil(daysBetween(before[0].date, firstDose) / 7);
  const windowStart = addDays(firstDose, -7 * weekCount);

  const weeks: (number | null)[][] = Array.from({ length: weekCount }, () => Array(7).fill(null));
  for (const { date, value } of before) {
    if (date < windowStart || value === null) continue;
    const block = Math.floor((daysBetween(date, firstDose) - 1) / 7);
    weeks[block][weekdayOf(date)] = value;
  }

  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const week of weeks) {
    week.forEach((value, w) => {
      if (value === null) return;
      sums[w] += value;
      counts[w]++;
    });
  }

  return {
    status: counts.every((c) => c >= minPerWeekday) ? "ok" : "notEnoughPreDrugData",
    means: sums.map((s, w) => (counts[w] > 0 ? s / counts[w] : null)),
    counts,
    weeks,
  };
}
