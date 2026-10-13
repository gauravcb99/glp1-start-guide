import { describe, expect, it } from "vitest";
import { localDate, normalizeDays, parseOffsetMinutes } from "@/lib/whoop/normalize";
import type { WhoopCycle, WhoopRecovery, WhoopSleep } from "@/lib/whoop/types";

// Fixtures follow the shape of WHOOP's v2 doc examples. All values are made up.

function cycle(id: number, over: Partial<WhoopCycle> = {}): WhoopCycle {
  return {
    id,
    start: "2026-03-01T03:00:00.000Z",
    end: "2026-03-02T03:00:00.000Z",
    timezone_offset: "-05:00",
    score_state: "SCORED",
    score: { strain: 10.5 },
    ...over,
  };
}

function recovery(cycleId: number, sleepId: string, over: Partial<WhoopRecovery> = {}): WhoopRecovery {
  return {
    cycle_id: cycleId,
    sleep_id: sleepId,
    score_state: "SCORED",
    score: {
      user_calibrating: false,
      recovery_score: 60,
      resting_heart_rate: 55,
      hrv_rmssd_milli: 70.5,
      spo2_percentage: 96.1,
      skin_temp_celsius: 33.4,
    },
    ...over,
  };
}

function sleep(id: string, cycleId: number, start: string, end: string, over: Partial<WhoopSleep> = {}): WhoopSleep {
  return {
    id,
    cycle_id: cycleId,
    start,
    end,
    timezone_offset: "-05:00",
    nap: false,
    score_state: "SCORED",
    score: { sleep_performance_percentage: 88, respiratory_rate: 15.2 },
    ...over,
  };
}

describe("timezone helpers", () => {
  it("parses +hh:mm, -hh:mm and Z", () => {
    expect(parseOffsetMinutes("-05:00")).toBe(-300);
    expect(parseOffsetMinutes("+09:30")).toBe(570);
    expect(parseOffsetMinutes("Z")).toBe(0);
  });

  it("throws on a malformed offset", () => {
    expect(() => parseOffsetMinutes("-0500")).toThrow();
    expect(() => parseOffsetMinutes("EST")).toThrow();
  });

  it("shifts a UTC instant into the local date", () => {
    expect(localDate("2026-03-02T03:00:00.000Z", "-05:00")).toBe("2026-03-01");
    expect(localDate("2026-03-02T03:00:00.000Z", "Z")).toBe("2026-03-02");
  });
});

describe("normalizeDays", () => {
  it("dates a bedtime after midnight by the wake morning, one row", () => {
    // 01:30 to 09:00 local (-05:00) on 2026-03-02
    const s = sleep("s1", 1, "2026-03-02T06:30:00.000Z", "2026-03-02T14:00:00.000Z");
    const { rows, issues } = normalizeDays([cycle(1)], [recovery(1, "s1")], [s]);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-03-02");
    expect(issues.duplicateDates).toEqual([]);
  });

  it("dates a late bedtime by the wake morning, not the cycle start date", () => {
    // 23:30 local on 03-01 to 07:00 local on 03-02; the cycle starts 03-01 local
    const c = cycle(2, { start: "2026-03-02T04:30:00.000Z" });
    const s = sleep("s2", 2, "2026-03-02T04:30:00.000Z", "2026-03-02T12:00:00.000Z");
    const { rows } = normalizeDays([c], [recovery(2, "s2")], [s]);
    expect(rows[0].date).toBe("2026-03-02");
  });

  it("uses each sleep's own offset across a timezone change, with no duplicate or gap", () => {
    // Night 1 in New York (-05:00): wake 07:00 local on 03-02.
    const ny = sleep("ny", 10, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    // Night 2 in Tokyo (+09:00): wake 07:30 local on 03-04, which is 03-03 in UTC.
    const tokyo = sleep("tk", 11, "2026-03-03T14:00:00.000Z", "2026-03-03T22:30:00.000Z", {
      timezone_offset: "+09:00",
    });
    // Night 3 in Tokyo: wake 07:00 local on 03-05.
    const tokyo2 = sleep("tk2", 12, "2026-03-04T13:30:00.000Z", "2026-03-04T22:00:00.000Z", {
      timezone_offset: "+09:00",
    });
    const { rows, issues } = normalizeDays(
      [cycle(10), cycle(11), cycle(12)],
      [recovery(10, "ny"), recovery(11, "tk"), recovery(12, "tk2")],
      [ny, tokyo, tokyo2],
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-03-02", "2026-03-04", "2026-03-05"]);
    expect(issues.duplicateDates).toEqual([]);
  });

  it("treats a Z offset as UTC", () => {
    const s = sleep("z", 3, "2026-03-01T23:00:00.000Z", "2026-03-02T06:00:00.000Z", { timezone_offset: "Z" });
    expect(normalizeDays([cycle(3)], [recovery(3, "z")], [s]).rows[0].date).toBe("2026-03-02");
  });

  it("ignores naps: they never create rows or replace the main sleep", () => {
    const main = sleep("main", 4, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const nap = sleep("nap", 4, "2026-03-02T19:00:00.000Z", "2026-03-02T19:40:00.000Z", {
      nap: true,
      score: { sleep_performance_percentage: 20, respiratory_rate: 14 },
    });
    const { rows } = normalizeDays([cycle(4)], [recovery(4, "main")], [nap, main]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sleepPerformance).toBe(88);
  });

  it("copies scored values into the documented DailyRow fields", () => {
    const s = sleep("s5", 5, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const { rows } = normalizeDays([cycle(5)], [recovery(5, "s5")], [s]);
    expect(rows[0]).toEqual({
      date: "2026-03-02",
      cycleId: 5,
      restingHr: 55,
      hrvMs: 70.5,
      recovery: 60,
      sleepPerformance: 88,
      respiratoryRate: 15.2,
      skinTempC: 33.4,
      strain: 10.5,
      calibrating: false,
    });
  });

  it.each(["PENDING_SCORE", "UNSCORABLE"] as const)(
    "nulls recovery fields when the recovery is %s, keeping sleep fields",
    (state) => {
      const s = sleep("s6", 6, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
      const rec: WhoopRecovery = { cycle_id: 6, sleep_id: "s6", score_state: state };
      const [row] = normalizeDays([cycle(6)], [rec], [s]).rows;
      expect(row.restingHr).toBeNull();
      expect(row.hrvMs).toBeNull();
      expect(row.recovery).toBeNull();
      expect(row.skinTempC).toBeNull();
      expect(row.calibrating).toBe(false);
      expect(row.sleepPerformance).toBe(88);
    },
  );

  it("passes through user_calibrating from a scored recovery", () => {
    const s = sleep("s7", 7, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const rec = recovery(7, "s7");
    rec.score!.user_calibrating = true;
    expect(normalizeDays([cycle(7)], [rec], [s]).rows[0].calibrating).toBe(true);
  });

  it("nulls sleep fields for an unscored sleep but still dates the row", () => {
    const s = sleep("s8", 8, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z", {
      score_state: "UNSCORABLE",
      score: undefined,
    });
    const [row] = normalizeDays([cycle(8)], [recovery(8, "s8")], [s]).rows;
    expect(row.date).toBe("2026-03-02");
    expect(row.sleepPerformance).toBeNull();
    expect(row.respiratoryRate).toBeNull();
    expect(row.restingHr).toBe(55);
  });

  it("makes no row for a recovery with no main sleep, and reports it", () => {
    const nap = sleep("nap", 9, "2026-03-02T19:00:00.000Z", "2026-03-02T19:40:00.000Z", { nap: true });
    const { rows, issues } = normalizeDays([cycle(9)], [recovery(9, "missing")], [nap]);
    expect(rows).toEqual([]);
    expect(issues.recoveriesWithoutMainSleep).toEqual([9]);
  });

  it("keeps a row with null recovery fields when the recovery is missing", () => {
    const s = sleep("s13", 13, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const [row] = normalizeDays([cycle(13)], [], [s]).rows;
    expect(row.restingHr).toBeNull();
    expect(row.sleepPerformance).toBe(88);
  });

  it("nulls strain while the cycle is still in progress (no end)", () => {
    const s = sleep("s14", 14, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const live = cycle(14, { end: undefined });
    expect(normalizeDays([live], [recovery(14, "s14")], [s]).rows[0].strain).toBeNull();
  });

  it("nulls strain for an unscored cycle", () => {
    const s = sleep("s15", 15, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const c = cycle(15, { score_state: "PENDING_SCORE", score: undefined });
    expect(normalizeDays([c], [recovery(15, "s15")], [s]).rows[0].strain).toBeNull();
  });

  it("flags two rows landing on one date and keeps both", () => {
    const a = sleep("a", 16, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const b = sleep("b", 17, "2026-03-02T15:00:00.000Z", "2026-03-02T21:00:00.000Z");
    const { rows, issues } = normalizeDays(
      [cycle(16), cycle(17)],
      [recovery(16, "a"), recovery(17, "b")],
      [a, b],
    );
    expect(rows).toHaveLength(2);
    expect(issues.duplicateDates).toEqual(["2026-03-02"]);
  });

  it("picks the main sleep named by the recovery when a cycle has two", () => {
    const first = sleep("first", 18, "2026-03-02T04:00:00.000Z", "2026-03-02T07:00:00.000Z", {
      score: { sleep_performance_percentage: 40, respiratory_rate: 15 },
    });
    const second = sleep("second", 18, "2026-03-02T08:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const { rows, issues } = normalizeDays([cycle(18)], [recovery(18, "second")], [first, second]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sleepPerformance).toBe(88);
    expect(issues.multipleMainSleeps).toEqual([]);
  });

  it("reports a cycle with two main sleeps when the recovery names neither", () => {
    const a = sleep("x", 19, "2026-03-02T04:00:00.000Z", "2026-03-02T07:00:00.000Z");
    const b = sleep("y", 19, "2026-03-02T08:00:00.000Z", "2026-03-02T12:00:00.000Z");
    const { rows, issues } = normalizeDays([cycle(19)], [recovery(19, "z")], [a, b]);
    expect(rows).toEqual([]);
    expect(issues.multipleMainSleeps).toEqual([19]);
  });

  it("throws on a malformed timezone_offset instead of guessing a date", () => {
    const s = sleep("bad", 20, "2026-03-02T04:00:00.000Z", "2026-03-02T12:00:00.000Z", { timezone_offset: "-5" });
    expect(() => normalizeDays([cycle(20)], [], [s])).toThrow();
  });

  it("sorts rows by date", () => {
    const later = sleep("l", 21, "2026-03-05T04:00:00.000Z", "2026-03-05T12:00:00.000Z");
    const earlier = sleep("e", 22, "2026-03-03T04:00:00.000Z", "2026-03-03T12:00:00.000Z");
    const { rows } = normalizeDays([cycle(21), cycle(22)], [], [later, earlier]);
    expect(rows.map((r) => r.date)).toEqual(["2026-03-03", "2026-03-05"]);
  });
});
