import type { Weekday } from "./types";

// Calendar-date arithmetic on YYYY-MM-DD strings, in UTC so no local timezone or DST shifts in.

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromMs(toMs(date) + days * DAY_MS);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

export function weekdayOf(date: string): Weekday {
  return new Date(toMs(date)).getUTCDay() as Weekday;
}
