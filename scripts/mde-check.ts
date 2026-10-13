// Detectability check: how big a within-week effect the current analysis config can call "clear"
// on persona B's noise. Uses a minimal reference estimator written from the CLAUDE.md spec for
// B's simple case (regular 7-day cycles, nothing missed or moved, no exclusions). It is a
// check on the config, not the Phase 4 engine.
//
// Run: npx tsx scripts/mde-check.ts [seedCount]
// Default seeds are personaConfig.testSeeds. SE is the largest per-day SD across seeds, which
// reads high with few seeds (max of noisy estimates); pass e.g. 2000 for a converged figure.
import { analysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { personaConfig } from "@/config/personas";
import type { DailyRow, Metric } from "@/lib/analysis/types";
import { generatePersona } from "@/lib/personas/generate";

const DAY_MS = 24 * 60 * 60 * 1000;
const Z_80 = 0.8416; // one-sided 80% power

const preWindow = requireConfig(analysisConfig, "preDrugWindow");
const minPerWeekday = requireConfig(analysisConfig, "minPreDrugWeeksPerWeekday");
const minDays = requireConfig(analysisConfig, "minDaysPerCycle");
const dayZero = requireConfig(analysisConfig, "dayZeroRule");
const metrics = requireConfig(analysisConfig, "metricsShown");
const clearRule = requireConfig(analysisConfig, "clearPatternRule");
const calibratingRule = requireConfig(analysisConfig, "calibratingRule");
const seedCountArg = Number(process.argv[2]);
const seeds =
  Number.isInteger(seedCountArg) && seedCountArg > 1
    ? Array.from({ length: seedCountArg }, (_, i) => i + 1)
    : requireConfig(personaConfig, "testSeeds");
const noiseSd = requireConfig(personaConfig, "noiseSd");
const planted = requireConfig(personaConfig, "personas").A.plantedProfile;

if (preWindow.kind !== "lastWeeks") throw new Error("mde-check handles preDrugWindow lastWeeks only");
if (clearRule.correction !== "acrossDaysAndMetrics") throw new Error("mde-check assumes acrossDaysAndMetrics");
const preWeeks = preWindow.weeks;

const alpha = 0.05 / (7 * metrics.length);
const zStar = inverseNormal(1 - alpha / 2);

type Estimate = { profile: number[]; cycles: number; preCounts: number[] };

const estimates: Record<string, Estimate[]> = Object.fromEntries(metrics.map((m) => [m, []]));
for (const seed of seeds) {
  const { inputs, rows } = generatePersona(personaConfig, "B", seed);
  for (const m of metrics) estimates[m].push(estimateProfile(rows, inputs.firstDoseDate, inputs.injectionTime, m));
}

console.log(`Persona B, ${seeds.length} seeds. Corrected level 1 - 0.05/(7 × ${metrics.length}) = ${(1 - alpha).toFixed(5)}, z* = ${zStar.toFixed(3)}`);
console.log("MDE50 = z* × SE (corrected interval just excludes zero; detected ~half the time)");
console.log("MDE80 = (z* + 0.84) × SE (detected ~80% of the time)\n");
console.log("metric            sd    SE(sim)  SE(analytic)  MDE50 (×sd)       MDE80 (×sd)       cycles  pre/weekday");

const mde: Record<string, { m50: number; m80: number }> = {};
for (const m of metrics) {
  const est = estimates[m];
  const se = Math.max(...Array.from({ length: 7 }, (_, d) => sd(est.map((e) => e.profile[d]))));
  const cycles = mean(est.map((e) => e.cycles));
  const pre = mean(est.flatMap((e) => e.preCounts));
  const sigma = noiseSd[m]!;
  const analytic = sigma * Math.sqrt((6 / 7) * (1 / cycles + 1 / pre));
  const m50 = zStar * se;
  const m80 = (zStar + Z_80) * se;
  mde[m] = { m50, m80 };
  console.log(
    [
      m.padEnd(16),
      sigma.toFixed(1).padStart(5),
      se.toFixed(3).padStart(9),
      analytic.toFixed(3).padStart(13),
      `${m50.toFixed(2)} (${(m50 / sigma).toFixed(2)})`.padStart(16),
      `${m80.toFixed(2)} (${(m80 / sigma).toFixed(2)})`.padStart(17),
      cycles.toFixed(1).padStart(8),
      pre.toFixed(1).padStart(12),
    ].join(" "),
  );
}

console.log("\nPersona A planted values (non-zero) compared with MDE:");
let below50 = 0;
if (planted !== "none") {
  for (const m of metrics) {
    const profile = planted[m];
    if (!profile) continue;
    profile.forEach((value, d) => {
      if (value === 0) return;
      const size = Math.abs(value);
      const flag = size < mde[m].m50 ? "BELOW MDE50" : size < mde[m].m80 ? "below MDE80" : "ok";
      if (size < mde[m].m50) below50++;
      console.log(`  ${m.padEnd(16)} d=${d}  ${String(value).padStart(4)}  ${flag}`);
    });
  }
}
console.log(`\n${below50} planted value(s) below MDE50.`);

function estimateProfile(rows: DailyRow[], firstDoseDate: string, time: "morning" | "evening", m: Metric): Estimate {
  const firstDoseMs = Date.parse(`${firstDoseDate}T00:00:00Z`);
  const included = (r: DailyRow) => !(calibratingRule === "exclude" && r.calibrating) && r[m] !== null;

  // 1. Pre-drug weekday means over the last N weeks before the first dose.
  const preStart = firstDoseMs - preWeeks * 7 * DAY_MS;
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const r of rows) {
    const ms = Date.parse(`${r.date}T00:00:00Z`);
    if (ms < preStart || ms >= firstDoseMs || !included(r)) continue;
    const w = new Date(ms).getUTCDay();
    sums[w] += r[m] as number;
    counts[w]++;
  }
  if (counts.some((c) => c < minPerWeekday)) throw new Error(`not enough pre-drug data for ${m}`);
  const preMean = sums.map((s, w) => s / counts[w]);

  // 2-4. Adjust, assign d from the day-zero rule, keep cycles with enough days, centre within cycle.
  const dayZeroMs = firstDoseMs + dayZero[time] * DAY_MS;
  const byCycle = new Map<number, { d: number; a: number }[]>();
  for (const r of rows) {
    const ms = Date.parse(`${r.date}T00:00:00Z`);
    if (ms < dayZeroMs || !included(r)) continue;
    const since = Math.round((ms - dayZeroMs) / DAY_MS);
    const a = (r[m] as number) - preMean[new Date(ms).getUTCDay()];
    const list = byCycle.get(Math.floor(since / 7)) ?? [];
    list.push({ d: since % 7, a });
    byCycle.set(Math.floor(since / 7), list);
  }

  // 5. P(d) = mean of centred values over cycles.
  const dSums = Array(7).fill(0);
  const dCounts = Array(7).fill(0);
  let cycles = 0;
  for (const days of byCycle.values()) {
    if (days.length < minDays) continue;
    cycles++;
    const cycleMean = mean(days.map((x) => x.a));
    for (const { d, a } of days) {
      dSums[d] += a - cycleMean;
      dCounts[d]++;
    }
  }
  return { profile: dSums.map((s, d) => s / dCounts[d]), cycles, preCounts: counts };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  const mu = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / (xs.length - 1));
}

/** Standard normal CDF via the Abramowitz–Stegun 7.1.26 erf approximation (|error| < 1.5e-7). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

function inverseNormal(p: number): number {
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
