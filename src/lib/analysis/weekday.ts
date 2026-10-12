import type { AnalysisConfig } from "@/config/analysis";
import type { DailyRow, MemberInputs, WeekdayMeans } from "./types";

/** Pre-drug mean per metric per weekday (Analysis spec step 1). */
export function preDrugWeekdayMeans(
  _rows: DailyRow[],
  _inputs: MemberInputs,
  _cfg: AnalysisConfig,
): WeekdayMeans {
  throw new Error("Not implemented: Phase 4");
}
