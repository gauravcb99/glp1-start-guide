import type { DailyRow } from "@/lib/analysis/types";
import type { WhoopCycle, WhoopRecovery, WhoopSleep } from "./types";

/** Problems found while joining. Rows are never silently merged or guessed. */
export type NormalizeIssues = {
  /** Dates that more than one row landed on (all rows are kept). */
  duplicateDates: string[];
  /** Cycles with a recovery but no main (non-nap) sleep to date it by; no row is made. */
  recoveriesWithoutMainSleep: number[];
  /** Cycles with several main sleeps where the recovery's sleep_id matched none; no row is made. */
  multipleMainSleeps: number[];
};

/**
 * Joins main sleep, recovery and cycle on cycle_id into one DailyRow per main sleep,
 * dated by the sleep's END shifted by its timezone_offset (the wake morning).
 * Anything not SCORED contributes null. Strain is null while its cycle is still in progress.
 */
export function normalizeDays(
  cycles: WhoopCycle[],
  recoveries: WhoopRecovery[],
  sleeps: WhoopSleep[],
): { rows: DailyRow[]; issues: NormalizeIssues } {
  const cycleById = new Map(cycles.map((c) => [c.id, c]));
  const recoveryByCycle = new Map(recoveries.map((r) => [r.cycle_id, r]));

  const mainSleepsByCycle = new Map<number, WhoopSleep[]>();
  for (const sleep of sleeps) {
    if (sleep.nap) continue;
    const list = mainSleepsByCycle.get(sleep.cycle_id) ?? [];
    list.push(sleep);
    mainSleepsByCycle.set(sleep.cycle_id, list);
  }

  const issues: NormalizeIssues = {
    duplicateDates: [],
    recoveriesWithoutMainSleep: [],
    multipleMainSleeps: [],
  };

  for (const recovery of recoveries) {
    if (!mainSleepsByCycle.has(recovery.cycle_id)) {
      issues.recoveriesWithoutMainSleep.push(recovery.cycle_id);
    }
  }

  const rows: DailyRow[] = [];
  for (const [cycleId, candidates] of mainSleepsByCycle) {
    const recovery = recoveryByCycle.get(cycleId);
    const sleep =
      candidates.length === 1
        ? candidates[0]
        : candidates.find((s) => s.id === recovery?.sleep_id);
    if (!sleep) {
      issues.multipleMainSleeps.push(cycleId);
      continue;
    }
    rows.push(buildRow(sleep, recovery, cycleById.get(cycleId)));
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
  issues.duplicateDates = [...counts].filter(([, n]) => n > 1).map(([date]) => date);

  return { rows, issues };
}

function buildRow(
  sleep: WhoopSleep,
  recovery: WhoopRecovery | undefined,
  cycle: WhoopCycle | undefined,
): DailyRow {
  const rec = recovery?.score_state === "SCORED" ? recovery.score : undefined;
  const slp = sleep.score_state === "SCORED" ? sleep.score : undefined;
  const cyc = cycle?.score_state === "SCORED" && cycle.end ? cycle.score : undefined;

  return {
    date: localDate(sleep.end, sleep.timezone_offset),
    cycleId: sleep.cycle_id,
    restingHr: rec?.resting_heart_rate ?? null,
    hrvMs: rec?.hrv_rmssd_milli ?? null,
    recovery: rec?.recovery_score ?? null,
    sleepPerformance: slp?.sleep_performance_percentage ?? null,
    respiratoryRate: slp?.respiratory_rate ?? null,
    skinTempC: rec?.skin_temp_celsius ?? null,
    strain: cyc?.strain ?? null,
    calibrating: rec?.user_calibrating ?? false,
  };
}

const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;

/** Minutes east of UTC for "+hh:mm", "-hh:mm" or "Z". Throws on anything else. */
export function parseOffsetMinutes(offset: string): number {
  if (offset === "Z") return 0;
  const match = OFFSET_PATTERN.exec(offset);
  if (!match) throw new Error("Malformed timezone_offset");
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Local YYYY-MM-DD of a UTC instant shifted by a WHOOP timezone_offset. */
export function localDate(isoInstant: string, offset: string): string {
  const ms = Date.parse(isoInstant);
  if (Number.isNaN(ms)) throw new Error("Malformed timestamp");
  return new Date(ms + parseOffsetMinutes(offset) * 60_000).toISOString().slice(0, 10);
}
