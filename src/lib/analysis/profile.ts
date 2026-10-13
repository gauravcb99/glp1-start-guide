import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { mulberry32 } from "@/lib/random";
import { buildCycles, type Cycle } from "./cycles";
import { metricValues, notImplemented } from "./rows";
import type {
  DailyRow,
  Interval,
  MemberInputs,
  Metric,
  Profile,
  ProfilePoint,
  ProfileStatus,
  View,
  WeekAnalysis,
} from "./types";
import { studentTQuantile, welchSatterthwaiteDf } from "./stats";
import { preDrugWeekdayMeans } from "./weekday";

const DAYS = 7;

/**
 * Level for the clear-pattern decision: the family error 1 − uncertaintyMethod.level split
 * (Bonferroni) over the days and metrics tested, as clearPatternRule.correction says.
 */
export function decisionLevel(cfg: AnalysisConfig): number {
  const { level } = requireConfig(cfg, "uncertaintyMethod");
  const { correction } = requireConfig(cfg, "clearPatternRule");
  const metrics = requireConfig(cfg, "metricsShown").length;
  const tests = correction === "none" ? 1 : correction === "acrossDays" ? DAYS : DAYS * metrics;
  return 1 - (1 - level) / tests;
}

/**
 * Steps 4–6 (with 1–3 inside): P(d) for one metric, its bootstrap intervals over cycles,
 * and which days are clear. In the raw view x_t is used in place of a_t.
 */
export function computeProfile(
  rows: DailyRow[],
  inputs: MemberInputs,
  metric: Metric,
  view: View,
  cfg: AnalysisConfig,
): Profile {
  const method = requireConfig(cfg, "uncertaintyMethod");
  const rule = requireConfig(cfg, "clearPatternRule");
  const minCycles = requireConfig(cfg, "minCycles");
  const bandLevel = method.level;
  const decisionLvl = decisionLevel(cfg);
  if (method.kind !== "bootstrapCycles") throw notImplemented(`uncertaintyMethod "${method.kind}"`);

  const base = { metric, view, bandLevel, decisionLevel: decisionLvl };

  const prepared = prepare(rows, inputs, metric, view, cfg);
  if (prepared.status !== "ok") return emptyProfile(base, prepared.status, 0);
  const { means, preWeeks, packed, estimate } = prepared;

  if (packed.length < minCycles) {
    return {
      ...emptyProfile(base, "notEnoughCycles", packed.length),
      points: Array.from({ length: DAYS }, (_, d) => point(d, estimate[d])),
    };
  }

  const rng = mulberry32(method.seed);
  const R = method.resamples;
  const weeksOrNull = view === "adjusted" ? preWeeks : null;
  const points: ProfilePoint[] = [];
  let discarded = 0;

  if (method.interval === "percentile") {
    // One joint bootstrap: resample pre-drug weeks (adjusted view) and cycles together.
    const joint = bootstrapDraws(packed, means, weeksOrNull, true, R, rng);
    discarded = joint.discarded;
    for (let d = 0; d < DAYS; d++) {
      const sorted = joint.draws[d].sort();
      const ok = sorted.length > 0 && !Number.isNaN(estimate[d]);
      points.push({
        ...point(d, estimate[d]),
        band: ok ? percentileInterval(sorted, bandLevel) : null,
        decision: ok ? percentileInterval(sorted, decisionLvl) : null,
        se: ok ? Math.sqrt(sampleVariance(sorted)) : null,
      });
    }
  } else {
    // t intervals from two component bootstraps: cycles only (weekday means fixed), then
    // pre-drug weeks only (all cycles kept). SE² is the sum of the two variances.
    // Each variance is scaled by n/(n − 1). This is the standard correction that makes a
    // bootstrap variance (which divides by n) match the unbiased variance a t interval assumes;
    // it is not a tuning knob.
    const byCycles = bootstrapDraws(packed, means, null, true, R, rng);
    const byWeeks = weeksOrNull ? bootstrapDraws(packed, means, weeksOrNull, false, R, rng) : null;
    discarded = byWeeks?.discarded ?? 0;
    const nCycles = packed.length;
    const nWeeks = preWeeks.length;
    for (let d = 0; d < DAYS; d++) {
      if (Number.isNaN(estimate[d]) || byCycles.draws[d].length < 2) {
        points.push(point(d, estimate[d]));
        continue;
      }
      const vCycles = (sampleVariance(byCycles.draws[d]) * nCycles) / (nCycles - 1);
      const vWeeks = byWeeks ? (sampleVariance(byWeeks.draws[d]) * nWeeks) / (nWeeks - 1) : 0;
      // tMinDf: df from the scarcer unit, min(cycles, pre-drug weeks) − 1 (raw view: cycles − 1).
      // tWelchSatterthwaite: df combining (cycles − 1) and (pre-drug weeks − 1).
      const df =
        method.interval === "tMinDf"
          ? (byWeeks ? Math.min(nCycles, nWeeks) : nCycles) - 1
          : welchSatterthwaiteDf([
              { variance: vCycles, df: nCycles - 1 },
              { variance: vWeeks, df: nWeeks - 1 },
            ]);
      const se = Math.sqrt(vCycles + vWeeks);
      points.push({
        ...point(d, estimate[d]),
        band: tInterval(estimate[d], se, df, bandLevel),
        decision: tInterval(estimate[d], se, df, decisionLvl),
        se,
        variance: { cycles: vCycles, preWeeks: vWeeks },
        df,
      });
    }
  }

  const clearDays = points
    .filter((p) => p.decision && (p.decision.lower > 0 || p.decision.upper < 0))
    .map((p) => p.d);

  return {
    ...base,
    status: "ok",
    cycles: packed.length,
    points,
    clearDays,
    clearPattern: clearDays.length >= rule.minDaysIntervalExcludesZero,
    discardedResamples: discarded,
  };
}

type Prepared =
  | { status: "notEnoughPreDrugData" }
  | {
      status: "ok";
      /** Weekday means (zeros in the raw view). */
      means: Float64Array;
      /** Pre-drug weeks the bootstrap resamples (empty in the raw view). */
      preWeeks: (number | null)[][];
      /** Cycles hold raw x so each bootstrap replicate can re-adjust with its own weekday means. */
      packed: PackedCycle[];
      estimate: Float64Array;
    };

/** Steps 1–5 without uncertainty: weekday means, cycles, centering and the P(d) point estimate. */
function prepare(rows: DailyRow[], inputs: MemberInputs, metric: Metric, view: View, cfg: AnalysisConfig): Prepared {
  let means = new Float64Array(DAYS);
  let preWeeks: (number | null)[][] = [];
  if (view === "adjusted") {
    const baseline = preDrugWeekdayMeans(rows, inputs, metric, cfg);
    if (baseline.status !== "ok") return { status: "notEnoughPreDrugData" };
    means = Float64Array.from(baseline.means as number[]);
    preWeeks = baseline.weeks;
  }
  const { cycles } = buildCycles(metricValues(rows, metric, cfg), inputs, cfg);
  const packed = cycles.map(pack);
  const estimate = new Float64Array(DAYS);
  profileInto(packed, null, means, estimate);
  return { status: "ok", means, preWeeks, packed, estimate };
}

/**
 * The engine's P(d) point estimate with no bootstrap, for simulations that need many runs
 * (the detectability table). Same steps and config as computeProfile.
 */
export function pointEstimate(
  rows: DailyRow[],
  inputs: MemberInputs,
  metric: Metric,
  view: View,
  cfg: AnalysisConfig,
): { status: "ok" | "notEnoughPreDrugData"; estimate: (number | null)[]; cycles: number; preWeeks: number } {
  const prepared = prepare(rows, inputs, metric, view, cfg);
  if (prepared.status !== "ok") return { status: prepared.status, estimate: [], cycles: 0, preWeeks: 0 };
  return {
    status: "ok",
    estimate: Array.from(prepared.estimate, (x) => (Number.isNaN(x) ? null : x)),
    cycles: prepared.packed.length,
    preWeeks: prepared.preWeeks.length,
  };
}

/** Every metric in cfg.metricsShown. clearPattern is true if any of them is clear. */
export function analyzeWeek(
  rows: DailyRow[],
  inputs: MemberInputs,
  view: View,
  cfg: AnalysisConfig,
): WeekAnalysis {
  const metrics = requireConfig(cfg, "metricsShown");
  const profiles = metrics.map((metric) => computeProfile(rows, inputs, metric, view, cfg));
  return { view, profiles, clearPattern: profiles.some((p) => p.clearPattern) };
}

type PackedCycle = { x: Float64Array; weekday: Uint8Array; d: Uint8Array };

function pack(cycle: Cycle): PackedCycle {
  return {
    x: Float64Array.from(cycle.days, (day) => day.value),
    weekday: Uint8Array.from(cycle.days, (day) => day.weekday),
    d: Uint8Array.from(cycle.days, (day) => day.d),
  };
}

const sums = new Float64Array(DAYS);
const counts = new Int32Array(DAYS);

/**
 * P(d) from a set of cycles (all of them, or the indices in `picks`), given weekday means:
 * a = x − means[weekday], centred within each cycle, averaged per d. NaN where no cycle has d.
 */
function profileInto(
  cycles: PackedCycle[],
  picks: Int32Array | null,
  means: Float64Array,
  out: Float64Array,
): void {
  sums.fill(0);
  counts.fill(0);
  const n = picks ? picks.length : cycles.length;
  for (let j = 0; j < n; j++) {
    const c = cycles[picks ? picks[j] : j];
    let total = 0;
    for (let i = 0; i < c.x.length; i++) total += c.x[i] - means[c.weekday[i]];
    const cycleMean = total / c.x.length;
    for (let i = 0; i < c.x.length; i++) {
      sums[c.d[i]] += c.x[i] - means[c.weekday[i]] - cycleMean;
      counts[c.d[i]]++;
    }
  }
  for (let d = 0; d < DAYS; d++) out[d] = counts[d] > 0 ? sums[d] / counts[d] : NaN;
}

/**
 * Bootstrap replicates of P(d). With `weeks`, each replicate redraws the pre-drug weeks and
 * recomputes the weekday means; with resampleCycles, it redraws cycles (otherwise all are kept).
 */
function bootstrapDraws(
  cycles: PackedCycle[],
  means: Float64Array,
  weeks: (number | null)[][] | null,
  resampleCycles: boolean,
  resamples: number,
  rng: () => number,
): { draws: Float64Array[]; discarded: number } {
  const draws = Array.from({ length: DAYS }, () => new Float64Array(resamples));
  const filled = new Int32Array(DAYS);
  const picks = resampleCycles ? new Int32Array(cycles.length) : null;
  const resampledMeans = new Float64Array(DAYS);
  const replicate = new Float64Array(DAYS);
  let discarded = 0;

  for (let r = 0; r < resamples; r++) {
    if (weeks && !resampleWeekdayMeans(weeks, rng, resampledMeans)) {
      discarded++;
      continue;
    }
    if (picks) for (let i = 0; i < picks.length; i++) picks[i] = Math.floor(rng() * cycles.length);
    profileInto(cycles, picks, weeks ? resampledMeans : means, replicate);
    for (let d = 0; d < DAYS; d++) {
      if (!Number.isNaN(replicate[d])) draws[d][filled[d]++] = replicate[d];
    }
  }
  return { draws: draws.map((x, d) => x.subarray(0, filled[d])), discarded };
}

function sampleVariance(xs: Float64Array): number {
  let mean = 0;
  for (let i = 0; i < xs.length; i++) mean += xs[i];
  mean /= xs.length;
  let ss = 0;
  for (let i = 0; i < xs.length; i++) ss += (xs[i] - mean) ** 2;
  return ss / (xs.length - 1);
}

function tInterval(estimate: number, se: number, df: number, level: number): Interval {
  const half = se === 0 ? 0 : studentTQuantile(1 - (1 - level) / 2, df) * se;
  return { lower: estimate - half, upper: estimate + half };
}

/** Weekday means from pre-drug weeks drawn with replacement; false if a weekday got no data. */
function resampleWeekdayMeans(weeks: (number | null)[][], rng: () => number, out: Float64Array): boolean {
  const total = new Float64Array(DAYS);
  const n = new Int32Array(DAYS);
  for (let k = 0; k < weeks.length; k++) {
    const week = weeks[Math.floor(rng() * weeks.length)];
    for (let w = 0; w < DAYS; w++) {
      const value = week[w];
      if (value !== null) {
        total[w] += value;
        n[w]++;
      }
    }
  }
  for (let w = 0; w < DAYS; w++) {
    if (n[w] === 0) return false;
    out[w] = total[w] / n[w];
  }
  return true;
}

/** Equal-tailed percentile interval with linear interpolation between order statistics. */
export function percentileInterval(sorted: Float64Array, level: number): Interval {
  const tail = (1 - level) / 2;
  return { lower: quantile(sorted, tail), upper: quantile(sorted, 1 - tail) };
}

function quantile(sorted: Float64Array, p: number): number {
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function point(d: number, estimate: number): ProfilePoint {
  return {
    d,
    estimate: Number.isNaN(estimate) ? null : estimate,
    band: null,
    decision: null,
    se: null,
    variance: null,
    df: null,
  };
}

function emptyProfile(
  base: Pick<Profile, "metric" | "view" | "bandLevel" | "decisionLevel">,
  status: ProfileStatus,
  cycles: number,
): Profile {
  return { ...base, status, cycles, points: [], clearDays: [], clearPattern: false, discardedResamples: 0 };
}
