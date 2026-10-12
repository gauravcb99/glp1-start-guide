import type { AnalysisConfig } from "@/config/analysis";
import type { DaySinceInjection, MemberInputs } from "./types";

export type CycleDay = {
  date: string;
  cycleIndex: number;
  d: DaySinceInjection;
  value: number | null;
  centered: number | null;
};

/** Injection dates from the weekday schedule, with missed and moved dates applied (step 3). */
export function injectionDates(
  _inputs: MemberInputs,
  _throughDate: string,
  _cfg: AnalysisConfig,
): string[] {
  throw new Error("Not implemented: Phase 4");
}

/** Assigns cycles and d, applies exclusions, and centers within each cycle (steps 3 and 4). */
export function assignCycles(
  _values: { date: string; value: number | null }[],
  _inputs: MemberInputs,
  _cfg: AnalysisConfig,
): CycleDay[] {
  throw new Error("Not implemented: Phase 4");
}
