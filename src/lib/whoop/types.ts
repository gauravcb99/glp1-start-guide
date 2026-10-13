// Raw WHOOP v2 records, limited to the fields this app reads.
// Source: developer.whoop.com API reference (cycle, recovery, sleep). `score` is only present when SCORED.

export type ScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE";

/** "+hh:mm", "-hh:mm" or "Z". */
export type TimezoneOffset = string;

export type WhoopCycle = {
  id: number;
  start: string;
  end?: string | null; // absent while the member is in this cycle
  timezone_offset: TimezoneOffset;
  score_state: ScoreState;
  score?: { strain: number };
};

export type WhoopRecovery = {
  cycle_id: number;
  sleep_id: string;
  score_state: ScoreState;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
};

export type WhoopSleep = {
  id: string;
  cycle_id: number;
  start: string;
  end: string;
  timezone_offset: TimezoneOffset;
  nap: boolean;
  score_state: ScoreState;
  score?: {
    sleep_performance_percentage?: number;
    respiratory_rate?: number;
  };
};

export type WhoopCollection<T> = {
  records: T[];
  next_token?: string | null;
};
