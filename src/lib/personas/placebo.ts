import { requireConfig } from "@/config/errors";
import type { PersonaConfig, PersonaId } from "@/config/personas";
import { addDays } from "@/lib/analysis/dates";
import type { DailyRow, MemberInputs } from "@/lib/analysis/types";
import { generatePersona } from "./generate";

/**
 * The placebo self-test case: a persona's pre-drug rows only, with a fake first dose
 * placeboStartOffsetWeeks after the start of its history (same weekday and time, no dose steps).
 */
export function placeboCase(cfg: PersonaConfig, id: PersonaId, seed: number): { rows: DailyRow[]; inputs: MemberInputs } {
  const firstDoseOffset = requireConfig(cfg, "firstDoseOffsetDays");
  const offsetWeeks = requireConfig(cfg, "placeboStartOffsetWeeks");
  const { rows, inputs } = generatePersona(cfg, id, seed);
  const historyStart = addDays(inputs.firstDoseDate, -firstDoseOffset);
  const fakeStart = addDays(historyStart, 7 * offsetWeeks);
  return {
    rows: rows.filter((r) => r.date < inputs.firstDoseDate),
    inputs: {
      ...inputs,
      firstDoseDate: fakeStart,
      injectionWeekdays: [{ from: fakeStart, weekday: inputs.injectionWeekdays[0].weekday }],
      doseSteps: [],
    },
  };
}
