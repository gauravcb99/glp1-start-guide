import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import type { PersonaConfig } from "@/config/personas";
import { generatePersona } from "@/lib/personas/generate";
import { decisionLevel, pointEstimate } from "./profile";
import { studentTQuantile, welchSatterthwaiteDf } from "./stats";
import type { Metric } from "./types";

// Smallest within-week change the analysis can call "clear" for one person, by simulation:
// persona B (no effect) is generated for many seeds, and the spread of the engine's P(d)
// point estimate across seeds is the standard error the clear-pattern test faces.

const POWER_80 = 0.8;

export type MdeRow = {
  metric: Metric;
  noiseSd: number;
  /** Largest per-day SD of P(d) across simulated runs. */
  se: number;
  /** Analytic check: σ·√((6/7)(1/cycles + 1/preWeeks)). */
  seAnalytic: number;
  /** Degrees of freedom of the critical value (null for a normal critical value). */
  df: number | null;
  critical: number;
  /** Change that just reaches the clear threshold: detected about half the time. */
  mde50: number;
  /** Change detected about 80% of the time. */
  mde80: number;
  cycles: number;
  preWeeks: number;
};

export type MdeResult = { runs: number; decisionLevel: number; interval: string; rows: MdeRow[] };

export function computeMde(personaCfg: PersonaConfig, cfg: AnalysisConfig, seeds: number[]): MdeResult {
  const metrics = requireConfig(cfg, "metricsShown");
  const method = requireConfig(cfg, "uncertaintyMethod");
  const noiseSd = requireConfig(personaCfg, "noiseSd");
  if (method.kind !== "bootstrapCycles") throw new Error("computeMde expects bootstrapCycles");
  const level = decisionLevel(cfg);
  const q = 1 - (1 - level) / 2;

  const runs = seeds.map((seed) => generatePersona(personaCfg, "B", seed));
  const rows = metrics.map((metric): MdeRow => {
    const estimates = runs.map(({ rows: r, inputs }) => pointEstimate(r, inputs, metric, "adjusted", cfg));
    if (estimates.some((e) => e.status !== "ok")) throw new Error(`not enough pre-drug data for ${metric}`);
    const se = Math.max(...Array.from({ length: 7 }, (_, d) => sd(estimates.map((e) => e.estimate[d] ?? NaN))));
    const cycles = mean(estimates.map((e) => e.cycles));
    const preWeeks = mean(estimates.map((e) => e.preWeeks));
    const sigma = noiseSd[metric]!;
    const vCycles = ((6 / 7) * sigma * sigma) / cycles;
    const vWeeks = ((6 / 7) * sigma * sigma) / preWeeks;

    let df: number | null;
    if (method.interval === "tMinDf") df = Math.min(Math.round(cycles), Math.round(preWeeks)) - 1;
    else if (method.interval === "tWelchSatterthwaite")
      df = welchSatterthwaiteDf([
        { variance: vCycles, df: cycles - 1 },
        { variance: vWeeks, df: preWeeks - 1 },
      ]);
    else df = null;

    const critical = df === null ? normalQuantile(q) : studentTQuantile(q, df);
    const power = df === null ? normalQuantile(POWER_80) : studentTQuantile(POWER_80, df);
    return {
      metric,
      noiseSd: sigma,
      se,
      seAnalytic: Math.sqrt(vCycles + vWeeks),
      df,
      critical,
      mde50: critical * se,
      mde80: (critical + power) * se,
      cycles,
      preWeeks,
    };
  });

  return { runs: seeds.length, decisionLevel: level, interval: method.interval, rows };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  const mu = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / (xs.length - 1));
}

/** Normal quantile as the large-df limit of Student's t. */
function normalQuantile(p: number): number {
  return studentTQuantile(p, 1e7);
}
