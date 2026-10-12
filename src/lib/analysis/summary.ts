import type { AnalysisConfig } from "@/config/analysis";
import type { Profile } from "./types";

/** Plain-language result built only from src/copy/strings.ts. */
export function summarize(_profiles: Profile[], _cfg: AnalysisConfig): string {
  throw new Error("Not implemented: Phase 5");
}
