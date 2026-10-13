import { addDays, weekdayOf } from "@/lib/analysis/dates";
import type { MemberInputs } from "@/lib/analysis/types";

// Member inputs live in this browser's localStorage only. Never WHOOP data.

export const INPUTS_KEY = "glp1.memberInputs.v1";

export type InputsError = "required" | "date" | "mg" | "firstWeekday";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: string) => DATE.test(s) && addDays(s, 0) === s;

export function validateInputs(inputs: MemberInputs): InputsError | null {
  if (!inputs.firstDoseDate || inputs.injectionWeekdays.length === 0) return "required";
  const dates = [
    inputs.firstDoseDate,
    ...inputs.injectionWeekdays.map((w) => w.from),
    ...inputs.missedInjectionDates,
    ...inputs.movedInjections.flatMap((m) => [m.scheduled, m.actual]),
    ...inputs.doseSteps.map((s) => s.date),
  ];
  if (!dates.every(isDate)) return "date";
  if (!inputs.doseSteps.every((s) => Number.isFinite(s.mg) && s.mg > 0)) return "mg";
  const first = [...inputs.injectionWeekdays].sort((a, b) => (a.from < b.from ? -1 : 1))[0];
  if (first.weekday !== weekdayOf(inputs.firstDoseDate)) return "firstWeekday";
  return null;
}

/** Saved inputs, or null if there are none, they don't parse, or storage is unavailable. */
export function loadInputs(): MemberInputs | null {
  try {
    const raw = window.localStorage.getItem(INPUTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemberInputs;
    return validateInputs(parsed) === null ? parsed : null;
  } catch {
    return null;
  }
}

export function saveInputs(inputs: MemberInputs): boolean {
  try {
    window.localStorage.setItem(INPUTS_KEY, JSON.stringify(inputs));
    return true;
  } catch {
    return false;
  }
}

export function clearInputs(): boolean {
  try {
    window.localStorage.removeItem(INPUTS_KEY);
    return true;
  } catch {
    return false;
  }
}
