// Formats src/data/methodResults.json for people: the self-test lines and the detectability table.
// Shared by the Method page and the README generator (scripts/readme-results.ts), so both always
// show the same numbers in the same words.
import { strings } from "@/copy/strings";
import type methodResults from "@/data/methodResults.json";

export type MethodResults = typeof methodResults;

const m = strings.method;

export type SelfTestLine = { text: string; pass: boolean };

export function selfTestLines(results: MethodResults): SelfTestLine[] {
  const { selfTests, maxFalsePatternRate } = results;
  const maxPct = Math.round(maxFalsePatternRate * 100);
  const worst = Math.max(...selfTests.planted.map((p) => p.maxErrorInNoiseSd));
  const tolerance = selfTests.planted[0].toleranceInNoiseSd;
  const trap = selfTests.weekdayTrap;

  return [
    { text: m.selfTests.planted(worst.toFixed(2), tolerance.toFixed(1)), pass: worst <= tolerance },
    {
      text: m.selfTests.null(selfTests.null.clear, selfTests.null.runs, maxPct),
      pass: selfTests.null.clear / selfTests.null.runs <= maxFalsePatternRate,
    },
    {
      text: m.selfTests.placebo(selfTests.placebo.clear, selfTests.placebo.runs, maxPct),
      pass: selfTests.placebo.clear / selfTests.placebo.runs <= maxFalsePatternRate,
    },
    {
      text: m.selfTests.trap(trap.habitD, trap.rawClearAtHabitDay, trap.adjustedClear),
      pass: trap.rawClearAtHabitDay && !trap.adjustedClear,
    },
  ];
}

export type MdeTable = {
  intro: string;
  rows: { metric: string; name: string; noise: string; half: string; most: string }[];
};

export function mdeTable(results: MethodResults): MdeTable {
  const { mde } = results;
  const fmt = (v: number, unit: string) => `${v.toFixed(1)} ${unit}`;
  return {
    intro: m.mdeIntro(mde.runs, Math.round(mde.rows[0].cycles), Math.round(mde.rows[0].preWeeks)),
    rows: mde.rows.map((row) => {
      const metric = strings.metrics[row.metric as keyof typeof strings.metrics];
      return {
        metric: row.metric,
        name: metric.name,
        noise: fmt(row.noiseSd, metric.sentenceUnit),
        half: fmt(row.mde50, metric.sentenceUnit),
        most: fmt(row.mde80, metric.sentenceUnit),
      };
    }),
  };
}
