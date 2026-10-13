import type { Drug } from "@/lib/analysis/types";

// Cited drug-label facts shown in the UI, copied from CLAUDE.md "Label facts".
// tests/copy.test.ts scans this file for banned phrasing.

export type LabelRange = {
  drug: Drug;
  /** Brand label the facts come from. */
  label: string;
  /** Mean resting heart rate increase across trial participants, in bpm. */
  restingHrIncreaseBpm: { low: number; high: number };
  hrSourceName: string;
  hrSourceUrl: string;
  halfLife: string;
  halfLifeSourceName: string;
  halfLifeSourceUrl: string;
};

export const labelRanges: Record<Drug, LabelRange> = {
  tirzepatide: {
    drug: "tirzepatide",
    label: "Zepbound",
    restingHrIncreaseBpm: { low: 1, high: 3 },
    hrSourceName: "Zepbound label (revised Aug 2026), DailyMed",
    hrSourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b",
    halfLife: "about 5 to 6 days",
    halfLifeSourceName: "Zepbound label (revised Aug 2026), DailyMed",
    halfLifeSourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b",
  },
  semaglutide: {
    drug: "semaglutide",
    label: "Wegovy",
    restingHrIncreaseBpm: { low: 1, high: 4 },
    hrSourceName: "Wegovy label, section 5.9 (via MedLibrary)",
    hrSourceUrl: "https://medlibrary.org/lib/rx/meds/wegovy/page/4/",
    halfLife: "about 1 week",
    halfLifeSourceName: "Wegovy label (FDA, Mar 2024)",
    halfLifeSourceUrl: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2024/215256s011lbl.pdf",
  },
};

/** WHOOP member study: shown as text only, never as a band. */
export const whoopStudy = {
  members: 132,
  restingHrChangeBpm: 3,
  hrvChangeMs: -6,
  sourceName: "WHOOP, Understanding GLP-1 therapies through WHOOP",
  sourceUrl: "https://www.whoop.com/us/en/thelocker/understanding-glp-1-therapies-through-whoop/",
};
