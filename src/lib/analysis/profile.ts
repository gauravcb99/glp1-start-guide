import type { AnalysisConfig } from "@/config/analysis";
import type { CycleDay } from "./cycles";
import type { Metric, Profile } from "./types";

/** P(d) with uncertainty over cycles, and the clear-pattern flag (steps 5 and 6). */
export function computeProfile(
  _days: CycleDay[],
  _metric: Metric,
  _view: Profile["view"],
  _cfg: AnalysisConfig,
): Profile {
  throw new Error("Not implemented: Phase 4");
}
