import type { DailyRow } from "@/lib/analysis/types";

/** Joins non-nap sleep, recovery and cycle into DailyRow, dated by wake morning. Record shapes are typed in Phase 2. */
export function normalizeDays(
  _cycles: unknown[],
  _recoveries: unknown[],
  _sleeps: unknown[],
): DailyRow[] {
  throw new Error("Not implemented: Phase 2");
}
