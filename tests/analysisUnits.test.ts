// Unit tests for the analysis mechanics on small hand-built rows. Each test starts from the real
// analysisConfig and changes only the mechanic under test, in a copy.
import { describe, expect, it } from "vitest";
import { analysisConfig, type AnalysisConfig } from "@/config/analysis";
import { adjustValues } from "@/lib/analysis/adjust";
import { buildCycles, injectionDates } from "@/lib/analysis/cycles";
import { addDays, weekdayOf } from "@/lib/analysis/dates";
import { computeLongView } from "@/lib/analysis/longView";
import { computeProfile, decisionLevel } from "@/lib/analysis/profile";
import { studentTQuantile, welchSatterthwaiteDf } from "@/lib/analysis/stats";
import type { DailyRow, DayValue, MemberInputs, Weekday } from "@/lib/analysis/types";
import { preDrugWeekdayMeans } from "@/lib/analysis/weekday";

const FIRST_DOSE = "2026-03-04"; // a Wednesday
const HISTORY_START = addDays(FIRST_DOSE, -7 * 12); // exactly 12 weeks before

function row(date: string, restingHr: number | null, calibrating = false): DailyRow {
  return {
    date,
    cycleId: date,
    restingHr,
    hrvMs: null,
    recovery: null,
    sleepPerformance: null,
    respiratoryRate: null,
    skinTempC: null,
    strain: null,
    calibrating,
  };
}

/** Daily rows from `start` for `days` days; `value` returns null to leave a gap. */
function rows(start: string, days: number, value: (date: string, i: number) => number | null): DailyRow[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return row(date, value(date, i));
  });
}

function inputs(over: Partial<MemberInputs> = {}): MemberInputs {
  return {
    drug: "semaglutide",
    firstDoseDate: FIRST_DOSE,
    injectionWeekdays: [{ from: FIRST_DOSE, weekday: 3 }],
    missedInjectionDates: [],
    movedInjections: [],
    injectionTime: "morning",
    doseSteps: [{ date: FIRST_DOSE, mg: 0.25 }],
    ...over,
  };
}

const cfg = (over: Partial<AnalysisConfig> = {}): AnalysisConfig => ({ ...analysisConfig, ...over });
const values = (rs: DailyRow[]): DayValue[] => rs.map((r) => ({ date: r.date, value: r.restingHr }));

describe("preDrugWeekdayMeans", () => {
  const weekdayValue = (date: string) => 50 + weekdayOf(date);
  const history = rows(HISTORY_START, 84 + 70, weekdayValue);

  it("averages each weekday over the pre-drug window", () => {
    const result = preDrugWeekdayMeans(history, inputs(), "restingHr", cfg());
    expect(result.status).toBe("ok");
    expect(result.means).toEqual([50, 51, 52, 53, 54, 55, 56]);
    expect(result.counts).toEqual([12, 12, 12, 12, 12, 12, 12]);
  });

  it("groups the window into 7-day blocks counted back from the first dose", () => {
    const result = preDrugWeekdayMeans(history, inputs(), "restingHr", cfg());
    expect(result.weeks).toHaveLength(12);
    expect(result.weeks[0][weekdayOf(addDays(FIRST_DOSE, -1))]).toBe(50 + weekdayOf(addDays(FIRST_DOSE, -1)));
    expect(result.weeks.every((w) => w.every((v) => v !== null))).toBe(true);
  });

  it("ignores rows outside the window and the first-dose morning", () => {
    const early = [row(addDays(HISTORY_START, -1), 999), ...history.map((r) => (r.date === FIRST_DOSE ? { ...r, restingHr: 999 } : r))];
    expect(preDrugWeekdayMeans(early, inputs(), "restingHr", cfg()).means).toEqual([50, 51, 52, 53, 54, 55, 56]);
  });

  it("reports not enough pre-drug data when a weekday has too few observations", () => {
    const min = analysisConfig.minPreDrugWeeksPerWeekday!;
    let mondaysKept = 0;
    const sparse = history.filter((r) => {
      if (r.date >= FIRST_DOSE || weekdayOf(r.date) !== 1) return true;
      return mondaysKept++ < min - 1;
    });
    expect(preDrugWeekdayMeans(sparse, inputs(), "restingHr", cfg()).status).toBe("notEnoughPreDrugData");
  });

  it("drops calibrating rows when calibratingRule is exclude, keeps them when keep", () => {
    const withCalibrating = history.map((r, i) => (i === 0 ? { ...r, restingHr: 1000, calibrating: true } : r));
    const w = weekdayOf(history[0].date);
    expect(preDrugWeekdayMeans(withCalibrating, inputs(), "restingHr", cfg({ calibratingRule: "exclude" })).means[w]).toBe(50 + w);
    expect(preDrugWeekdayMeans(withCalibrating, inputs(), "restingHr", cfg({ calibratingRule: "keep" })).means[w]).not.toBe(50 + w);
  });
});

describe("adjustValues", () => {
  it("subtracts the pre-drug mean for the row's weekday", () => {
    const history = rows(HISTORY_START, 84 + 7, (date) => 60 + weekdayOf(date));
    const baseline = preDrugWeekdayMeans(history, inputs(), "restingHr", cfg());
    const adjusted = adjustValues(history, "restingHr", baseline, cfg());
    expect(adjusted.every((a) => Math.abs(a.value!) < 1e-12)).toBe(true);
  });
});

describe("injectionDates", () => {
  it("follows the weekday schedule, minus missed dates, with moved dates replaced", () => {
    const dates = injectionDates(
      inputs({
        missedInjectionDates: ["2026-03-18"],
        movedInjections: [{ scheduled: "2026-03-25", actual: "2026-03-26" }],
      }),
      "2026-04-01",
    );
    expect(dates).toEqual(["2026-03-04", "2026-03-11", "2026-03-26", "2026-04-01"]);
  });

  it("switches weekday on the dated change", () => {
    const dates = injectionDates(
      inputs({
        injectionWeekdays: [
          { from: FIRST_DOSE, weekday: 3 },
          { from: "2026-03-16", weekday: 6 },
        ],
      }),
      "2026-03-31",
    );
    expect(dates).toEqual(["2026-03-04", "2026-03-11", "2026-03-21", "2026-03-28"]);
  });
});

describe("buildCycles", () => {
  const post = rows(FIRST_DOSE, 7 * 6 + 1, (_, i) => i);

  it.each([
    ["morning", 0, FIRST_DOSE],
    ["morning", 1, addDays(FIRST_DOSE, 1)],
    ["evening", 1, addDays(FIRST_DOSE, 1)],
  ] as const)("%s injection with day-zero offset %i puts d = 0 on %s", (time, offset, dayZero) => {
    const c = cfg({ dayZeroRule: { morning: offset, evening: offset } });
    const { cycles } = buildCycles(values(post), inputs({ injectionTime: time }), c);
    expect(cycles[0].dayZero).toBe(dayZero);
    expect(cycles[0].days[0]).toMatchObject({ date: dayZero, d: 0 });
    expect(cycles[0].days.map((x) => x.d)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("drops an irregular cycle created by a weekday change", () => {
    const changed = inputs({
      injectionWeekdays: [
        { from: FIRST_DOSE, weekday: 3 },
        { from: "2026-03-16", weekday: 6 },
      ],
    });
    const result = buildCycles(values(post), changed, cfg());
    expect(result.dropped.irregular).toBe(1); // 03-11 to 03-21 is 10 days
    expect(result.cycles.map((c) => c.injectionDate)).not.toContain("2026-03-11");
  });

  it("drops the 14-day cycle that spans a missed injection", () => {
    const result = buildCycles(values(post), inputs({ missedInjectionDates: ["2026-03-18"] }), cfg());
    expect(result.dropped.missedInjection).toBe(1);
    expect(result.cycles.map((c) => c.injectionDate)).not.toContain("2026-03-11");
  });

  it("drops both cycles around a moved injection (8 and 6 days long)", () => {
    const moved = inputs({ movedInjections: [{ scheduled: "2026-03-18", actual: "2026-03-19" }] });
    const result = buildCycles(values(post), moved, cfg());
    expect(result.dropped.irregular).toBe(2);
  });

  it("drops cycles with fewer than minDaysPerCycle values", () => {
    const min = analysisConfig.minDaysPerCycle!;
    const gappy = post.map((r, i) => (i >= 1 && i <= 7 - min + 1 ? { ...r, restingHr: null } : r));
    const baseline = buildCycles(values(post), inputs(), cfg()); // last injection's cycle has no data yet
    const result = buildCycles(values(gappy), inputs(), cfg());
    expect(result.dropped.tooFewDays).toBe(baseline.dropped.tooFewDays + 1);
    expect(result.cycles.map((c) => c.injectionDate)).not.toContain(FIRST_DOSE);
  });

  it("applies excludeWeeksAfterStart and excludeWeeksAfterDoseStep", () => {
    expect(buildCycles(values(post), inputs(), cfg({ excludeWeeksAfterStart: 2 })).dropped.excluded).toBe(2);
    const step = inputs({ doseSteps: [{ date: FIRST_DOSE, mg: 0.25 }, { date: "2026-03-25", mg: 0.5 }] });
    const result = buildCycles(values(post), step, cfg({ excludeWeeksAfterStart: 0, excludeWeeksAfterDoseStep: 1 }));
    expect(result.cycles.map((c) => c.injectionDate)).not.toContain("2026-03-25");
    expect(result.cycles.map((c) => c.injectionDate)).not.toContain(FIRST_DOSE); // the first dose is a step too
  });

  it("throws for options that have no agreed definition yet", () => {
    expect(() => buildCycles(values(post), inputs(), cfg({ irregularCycleRule: "keepActualLength" }))).toThrow(/not implemented/);
    expect(() => buildCycles(values(post), inputs(), cfg({ missedInjectionRule: "extendCycle" }))).toThrow(/not implemented/);
  });
});

describe("computeProfile", () => {
  const shape = [3, -2, 1, 0, -1, 2, -3]; // mean zero
  const nWeeks = 10;
  // Pre-drug weekday rhythm plus, after the first dose, a level that jumps every cycle and a
  // fixed within-cycle shape. Centering removes the per-cycle level; adjustment removes the rhythm.
  const rhythm = (date: string) => 5 * Math.sin(weekdayOf(date));
  const build = (noise: (i: number) => number) =>
    rows(HISTORY_START, 84 + 1 + 7 * nWeeks, (date, i) => {
      const sinceZero = i - 85; // d = 0 is the morning after the (morning) first dose
      if (sinceZero < 0) return 60 + rhythm(date) + noise(i);
      return 60 + rhythm(date) + 10 * Math.floor(sinceZero / 7) + shape[sinceZero % 7] + noise(i);
    });
  const fast = cfg({ uncertaintyMethod: { ...analysisConfig.uncertaintyMethod!, resamples: 500 } as AnalysisConfig["uncertaintyMethod"] });

  it("recovers a within-cycle shape exactly, removing per-cycle drift (adjusted view)", () => {
    const result = computeProfile(build(() => 0), inputs(), "restingHr", "adjusted", fast);
    expect(result.status).toBe("ok");
    expect(result.cycles).toBe(nWeeks);
    result.points.forEach((p, d) => expect(p.estimate!).toBeCloseTo(shape[d], 10));
    expect(result.points.reduce((s, p) => s + p.estimate!, 0)).toBeCloseTo(0, 10);
  });

  it("raw view keeps the weekday rhythm in the shape", () => {
    const result = computeProfile(build(() => 0), inputs(), "restingHr", "raw", fast);
    const rhythmCentered = Array.from({ length: 7 }, (_, d) => rhythm(addDays(FIRST_DOSE, 1 + d)));
    const mean = rhythmCentered.reduce((a, b) => a + b, 0) / 7;
    result.points.forEach((p, d) => expect(p.estimate!).toBeCloseTo(shape[d] + rhythmCentered[d] - mean, 10));
  });

  it("is reproducible for a bootstrap seed", () => {
    const noisy = build((i) => ((i * 7919) % 13) - 6);
    const a = computeProfile(noisy, inputs(), "restingHr", "adjusted", fast);
    const b = computeProfile(noisy, inputs(), "restingHr", "adjusted", fast);
    expect(a).toEqual(b);
  });

  it("tMinDf uses min(cycles, pre-drug weeks) − 1 in the adjusted view and cycles − 1 in raw", () => {
    const noisy = build((i) => ((i * 7919) % 13) - 6);
    const c = cfg({ uncertaintyMethod: { ...analysisConfig.uncertaintyMethod!, resamples: 500, interval: "tMinDf" } as AnalysisConfig["uncertaintyMethod"] });
    const adjusted = computeProfile(noisy, inputs(), "restingHr", "adjusted", c);
    const raw = computeProfile(noisy, inputs(), "restingHr", "raw", c);
    expect(adjusted.points[0].df).toBe(Math.min(nWeeks, 12) - 1);
    expect(raw.points[0].df).toBe(nWeeks - 1);
    expect(raw.points[0].variance!.preWeeks).toBe(0);
    const p = adjusted.points[2];
    expect(p.se!).toBeCloseTo(Math.sqrt(p.variance!.cycles + p.variance!.preWeeks), 12);
    const half = studentTQuantile(1 - (1 - adjusted.bandLevel) / 2, p.df!) * p.se!;
    expect(p.band!.upper - p.estimate!).toBeCloseTo(half, 10);
  });

  it("reports notEnoughCycles below minCycles, with no intervals and no clear pattern", () => {
    const short = build(() => 0).slice(0, 85 + 7 * (analysisConfig.minCycles! - 1));
    const result = computeProfile(short, inputs(), "restingHr", "adjusted", fast);
    expect(result.status).toBe("notEnoughCycles");
    expect(result.clearPattern).toBe(false);
    expect(result.points.every((p) => p.band === null)).toBe(true);
  });

  it("reports notEnoughPreDrugData when the weekday means can't be formed", () => {
    const noPre = build(() => 0).filter((r) => r.date >= FIRST_DOSE);
    expect(computeProfile(noPre, inputs(), "restingHr", "adjusted", fast).status).toBe("notEnoughPreDrugData");
  });

  it("throws for an uncertainty method with no agreed definition", () => {
    expect(() =>
      computeProfile(build(() => 0), inputs(), "restingHr", "adjusted", cfg({ uncertaintyMethod: { kind: "standardErrorCycles", level: 0.95 } })),
    ).toThrow(/not implemented/);
  });
});

describe("decisionLevel", () => {
  const level = analysisConfig.uncertaintyMethod!.level;
  const metrics = analysisConfig.metricsShown!.length;
  const withCorrection = (correction: "none" | "acrossDays" | "acrossDaysAndMetrics") =>
    decisionLevel(cfg({ clearPatternRule: { ...analysisConfig.clearPatternRule!, correction } }));

  it("splits the family error over days and metrics (Bonferroni)", () => {
    expect(withCorrection("acrossDaysAndMetrics")).toBeCloseTo(1 - (1 - level) / (7 * metrics), 12);
    expect(withCorrection("acrossDays")).toBeCloseTo(1 - (1 - level) / 7, 12);
    expect(withCorrection("none")).toBeCloseTo(level, 12);
  });
});

describe("computeLongView", () => {
  const window = analysisConfig.rollingWindowDays!;
  const minDays = analysisConfig.rollingMinDays!;
  const history = rows(HISTORY_START, 84 + 40, (date, i) => (i < 84 ? 60 : 63));

  it("trailing mean of a_t from the first dose, null until rollingMinDays valid days", () => {
    const view = computeLongView(history, inputs(), "restingHr", cfg());
    expect(view.status).toBe("ok");
    expect(view.points[0].date).toBe(FIRST_DOSE);
    expect(view.points[minDays - 2].rollingAdjusted).toBeNull();
    expect(view.points[minDays - 1].rollingAdjusted).toBeCloseTo(3, 12);
    expect(view.points[window + 5].n).toBe(window);
    expect(view.doseSteps).toEqual(inputs().doseSteps);
  });

  it("needs rollingMinDays valid days in the window", () => {
    const gappy = history.map((r, i) => (i >= 84 + 20 && i < 84 + 20 + window - minDays + 1 ? { ...r, restingHr: null } : r));
    const view = computeLongView(gappy, inputs(), "restingHr", cfg());
    const end = view.points.find((p) => p.date === addDays(FIRST_DOSE, 20 + window - minDays))!;
    expect(end.n).toBe(minDays - 1);
    expect(end.rollingAdjusted).toBeNull();
  });

  it("throws for a centered window, which has no agreed definition", () => {
    expect(() => computeLongView(history, inputs(), "restingHr", cfg({ rollingAlignment: "centered" }))).toThrow(/not implemented/);
  });
});

describe("stats", () => {
  it.each([
    [0.975, 1, 12.706],
    [0.975, 10, 2.228],
    [0.975, 29, 2.045],
    [0.995, 5, 4.032],
    [0.9995, 20, 3.85],
  ])("t quantile p=%f df=%i matches the table (%f)", (p, df, expected) => {
    expect(studentTQuantile(p, df)).toBeCloseTo(expected, 2);
  });

  it("t quantile is symmetric", () => {
    expect(studentTQuantile(0.025, 7)).toBeCloseTo(-studentTQuantile(0.975, 7), 10);
  });

  it("Welch–Satterthwaite df: one component gives its own df; two equal ones combine", () => {
    expect(welchSatterthwaiteDf([{ variance: 2, df: 9 }, { variance: 0, df: 11 }])).toBeCloseTo(9, 12);
    expect(welchSatterthwaiteDf([{ variance: 1, df: 29 }, { variance: 1, df: 11 }])).toBeCloseTo(4 / (1 / 29 + 1 / 11), 12);
  });
});

// Weekday type is used for clarity in fixtures above.
export type { Weekday };
