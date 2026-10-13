import { describe, expect, it } from "vitest";
import { analysisConfig as cfg } from "@/config/analysis";
import { personaConfig } from "@/config/personas";
import { strings } from "@/copy/strings";
import { analyzeWeek } from "@/lib/analysis/profile";
import { summarize } from "@/lib/analysis/summary";
import type { Profile, WeekAnalysis } from "@/lib/analysis/types";
import { generatePersona } from "@/lib/personas/generate";

const seed = personaConfig.seed!;

describe("summarize", () => {
  it("persona A: one line per metric, naming exactly the engine's clear days", () => {
    const { rows, inputs } = generatePersona(personaConfig, "A", seed);
    const analysis = analyzeWeek(rows, inputs, "adjusted", cfg);
    const lines = summarize(analysis);
    expect(lines).toHaveLength(analysis.profiles.length);

    analysis.profiles.forEach((profile, i) => {
      const line = lines[i];
      expect(line.startsWith(strings.metrics[profile.metric].name)).toBe(true);
      const named = [...line.matchAll(/day (\d)/g)].map((m) => Number(m[1]));
      expect(named).toEqual(profile.clearDays);
      if (profile.clearDays.length === 0) expect(line).toContain("no clear change on any day");
      else expect(line).toContain("No clear change on the other days");
      expect(line).not.toMatch(/\bno change\b/i);
    });
  });

  it("persona B: no clear pattern", () => {
    const { rows, inputs } = generatePersona(personaConfig, "B", seed);
    const analysis = analyzeWeek(rows, inputs, "adjusted", cfg);
    expect(analysis.clearPattern).toBe(false);
    expect(summarize(analysis)).toEqual([strings.summary.nothingClear]);
  });

  it("persona C raw view: says it's raw and names the habit day", () => {
    const { rows, inputs } = generatePersona(personaConfig, "C", seed);
    const lines = summarize(analyzeWeek(rows, inputs, "raw", cfg));
    expect(lines[0]).toBe(strings.summary.rawPrefix);
    expect(lines.slice(1).every((l) => /on day 0\b/.test(l))).toBe(true);
  });

  it("states above or below from the sign of the estimate", () => {
    const profile: Profile = {
      metric: "restingHr",
      view: "adjusted",
      status: "ok",
      cycles: 10,
      points: Array.from({ length: 7 }, (_, d) => ({
        d,
        estimate: d === 2 ? -4.26 : d === 5 ? 3.04 : 0,
        band: null,
        decision: null,
        se: null,
        variance: null,
        df: null,
      })),
      clearDays: [2, 5],
      clearPattern: true,
      bandLevel: 0.95,
      decisionLevel: 0.998,
      discardedResamples: 0,
    };
    const analysis: WeekAnalysis = { view: "adjusted", profiles: [profile], clearPattern: true };
    expect(summarize(analysis)).toEqual([
      "Resting heart rate averages 4.3 bpm below on day 2 and 3.0 bpm above on day 5, compared with your weekly average. No clear change on the other days.",
    ]);
  });

  it("says not enough data for a metric without enough cycles", () => {
    const profile = { metric: "hrvMs", status: "notEnoughCycles", clearDays: [], points: [] } as unknown as Profile;
    expect(summarize({ view: "adjusted", profiles: [profile], clearPattern: false })).toEqual([
      "HRV: not enough data yet.",
    ]);
  });
});
