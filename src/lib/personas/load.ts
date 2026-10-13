import type { PersonaId } from "@/config/personas";
import type { DailyRow, MemberInputs } from "@/lib/analysis/types";

export type PersonaFile = { synthetic: true; persona: PersonaId; seed: number; inputs: MemberInputs; rows: DailyRow[] };

/** Loads a synthetic persona's generated file on demand, so live mode never ships them. */
export async function loadPersona(id: PersonaId): Promise<PersonaFile> {
  const mod =
    id === "A"
      ? await import("@/data/personas/persona-a.json")
      : id === "B"
        ? await import("@/data/personas/persona-b.json")
        : await import("@/data/personas/persona-c.json");
  return mod.default as unknown as PersonaFile;
}

export function parsePersonaId(value: string | null): PersonaId | null {
  const id = value?.toUpperCase();
  return id === "A" || id === "B" || id === "C" ? id : null;
}

/** Keeps demo mode across links: appends ?demo=x when a persona is active. */
export function withDemo(href: string, persona: PersonaId | null): string {
  return persona ? `${href}?demo=${persona.toLowerCase()}` : href;
}
