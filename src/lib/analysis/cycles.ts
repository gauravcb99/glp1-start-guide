import type { AnalysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { addDays, daysBetween, weekdayOf } from "./dates";
import { notImplemented } from "./rows";
import type { DaySinceInjection, DayValue, MemberInputs, Weekday } from "./types";

export type CycleDay = { date: string; d: DaySinceInjection; weekday: Weekday; value: number };

export type Cycle = {
  injectionDate: string;
  /** Morning that counts as d = 0 (injection date + dayZeroRule offset). */
  dayZero: string;
  /** Days with a value; never more than one per d. */
  days: CycleDay[];
};

export type CycleSet = {
  cycles: Cycle[];
  dropped: { irregular: number; missedInjection: number; excluded: number; tooFewDays: number };
};

/**
 * Step 3a: injection dates from the weekday schedule (with dated changes), from the first dose
 * through `throughDate`, minus missed dates and with moved dates replaced.
 */
export function injectionDates(inputs: MemberInputs, throughDate: string): string[] {
  const segments = [...inputs.injectionWeekdays].sort((a, b) => (a.from < b.from ? -1 : 1));
  const scheduled: string[] = [];
  segments.forEach((segment, i) => {
    const from = segment.from < inputs.firstDoseDate ? inputs.firstDoseDate : segment.from;
    const until = segments[i + 1]?.from; // exclusive
    let date = addDays(from, (segment.weekday - weekdayOf(from) + 7) % 7);
    while (date <= throughDate && (until === undefined || date < until)) {
      scheduled.push(date);
      date = addDays(date, 7);
    }
  });

  const missed = new Set(inputs.missedInjectionDates);
  const moved = new Map(inputs.movedInjections.map((m) => [m.scheduled, m.actual]));
  const dates = scheduled
    .filter((date) => !missed.has(date))
    .map((date) => moved.get(date) ?? date)
    .filter((date) => date <= throughDate);
  return [...new Set(dates)].sort();
}

/**
 * Step 3b: splits post-dose values into injection cycles, assigns d, and applies
 * irregularCycleRule, missedInjectionRule, the exclusion windows and minDaysPerCycle.
 * `values` are one metric's daily values (raw or adjusted); null values are skipped.
 */
export function buildCycles(values: DayValue[], inputs: MemberInputs, cfg: AnalysisConfig): CycleSet {
  const dayZeroRule = requireConfig(cfg, "dayZeroRule");
  const irregularRule = requireConfig(cfg, "irregularCycleRule");
  const missedRule = requireConfig(cfg, "missedInjectionRule");
  const excludeAfterStart = requireConfig(cfg, "excludeWeeksAfterStart");
  const excludeAfterStep = requireConfig(cfg, "excludeWeeksAfterDoseStep");
  const minDays = requireConfig(cfg, "minDaysPerCycle");
  if (irregularRule !== "drop") throw notImplemented(`irregularCycleRule "${irregularRule}"`);
  if (missedRule !== "dropCycle") throw notImplemented(`missedInjectionRule "${missedRule}"`);

  const byDate = new Map<string, number>();
  for (const { date, value } of values) if (value !== null) byDate.set(date, value);
  const lastDate = values.length > 0 ? values[values.length - 1].date : inputs.firstDoseDate;

  const offset = dayZeroRule[inputs.injectionTime];
  const injections = injectionDates(inputs, lastDate);
  const missed = inputs.missedInjectionDates;
  const result: CycleSet = {
    cycles: [],
    dropped: { irregular: 0, missedInjection: 0, excluded: 0, tooFewDays: 0 },
  };

  injections.forEach((injection, i) => {
    const next = injections[i + 1] ?? addDays(injection, 7); // the last cycle is nominally 7 days
    const length = daysBetween(injection, next);

    if (missed.some((m) => m > injection && m < next)) {
      result.dropped.missedInjection++;
      return;
    }
    if (length !== 7) {
      result.dropped.irregular++;
      return;
    }
    const sinceStart = daysBetween(inputs.firstDoseDate, injection);
    const nearStep = inputs.doseSteps.some((step) => {
      const since = daysBetween(step.date, injection);
      return since >= 0 && since < 7 * excludeAfterStep;
    });
    if ((sinceStart >= 0 && sinceStart < 7 * excludeAfterStart) || nearStep) {
      result.dropped.excluded++;
      return;
    }

    const dayZero = addDays(injection, offset);
    const days: CycleDay[] = [];
    for (let d = 0; d < length; d++) {
      const date = addDays(dayZero, d);
      const value = byDate.get(date);
      if (value !== undefined) days.push({ date, d, weekday: weekdayOf(date), value });
    }
    if (days.length < minDays) {
      result.dropped.tooFewDays++;
      return;
    }
    result.cycles.push({ injectionDate: injection, dayZero, days });
  });

  return result;
}
