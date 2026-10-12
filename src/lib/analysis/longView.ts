import type { AnalysisConfig } from "@/config/analysis";
import type { AdjustedValue } from "./adjust";
import type { LongView, MemberInputs, Metric } from "./types";

/** Rolling mean of a_t since the first dose, with dose steps marked (step 7). */
export function computeLongView(
  _adjusted: AdjustedValue[],
  _metric: Metric,
  _inputs: MemberInputs,
  _cfg: AnalysisConfig,
): LongView {
  throw new Error("Not implemented: Phase 4");
}
