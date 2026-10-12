import type { Drug } from "@/lib/analysis/types";

/** Cited drug-label facts shown in the UI. Filled from CLAUDE.md "Label facts" in a later phase. */
export type LabelRange = {
  drug: Drug;
  label: string;
  restingHrIncreaseBpm: { low: number; high: number };
  halfLife: string;
  sourceUrl: string;
};

export const labelRanges: LabelRange[] = [];
