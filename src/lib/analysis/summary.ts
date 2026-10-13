import { strings } from "@/copy/strings";
import type { WeekAnalysis } from "./types";

/**
 * Plain-language result, built only from the engine's output and src/copy/strings.ts.
 * Clear days come from Profile.clearDays; every other day reads "no clear change".
 */
export function summarize(analysis: WeekAnalysis): string[] {
  const s = strings.summary;
  const lines: string[] = analysis.view === "raw" ? [s.rawPrefix] : [];
  const allOk = analysis.profiles.every((p) => p.status === "ok");

  if (allOk && !analysis.clearPattern) return [...lines, s.nothingClear];

  for (const profile of analysis.profiles) {
    const { name, sentenceUnit } = strings.metrics[profile.metric];
    if (profile.status !== "ok") {
      lines.push(s.metricNotEnough(name));
      continue;
    }
    if (profile.clearDays.length === 0) {
      lines.push(s.metricNone(name));
      continue;
    }
    const parts = profile.clearDays.map((d) => {
      const estimate = profile.points[d].estimate!;
      return s.dayPart(d, Math.abs(estimate), sentenceUnit, estimate > 0);
    });
    lines.push(s.metricLine(name, parts, profile.clearDays.length < profile.points.length));
  }
  return lines;
}
