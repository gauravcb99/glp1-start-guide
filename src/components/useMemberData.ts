"use client";

// One place that decides whose data a page shows: a synthetic persona (?demo=a|b|c) or the
// signed-in member (inputs from localStorage, rows from the in-memory WhoopDataProvider).
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PersonaId } from "@/config/personas";
import type { DailyRow, MemberInputs } from "@/lib/analysis/types";
import { loadInputs } from "@/lib/memberInputs";
import { loadPersona, parsePersonaId } from "@/lib/personas/load";
import { useWhoopData } from "./WhoopDataProvider";

export type MemberData =
  | { state: "loading"; demo: boolean }
  | { state: "notConnected" }
  | { state: "noInputs" }
  | { state: "error"; httpStatus: number }
  | { state: "ready"; persona: PersonaId | null; inputs: MemberInputs; rows: DailyRow[] };

export function useDemoPersona(): PersonaId | null {
  return parsePersonaId(useSearchParams().get("demo"));
}

export function useMemberData(): MemberData {
  const persona = useDemoPersona();
  const { state: whoop, ensureLoaded } = useWhoopData();
  const [demo, setDemo] = useState<{ id: PersonaId; inputs: MemberInputs; rows: DailyRow[] } | null>(null);
  // undefined: not read yet (shows loading until mounted); null: nothing saved.
  const [liveInputs, setLiveInputs] = useState<MemberInputs | null | undefined>(undefined);

  useEffect(() => {
    if (!persona) return;
    let cancelled = false;
    loadPersona(persona).then((file) => {
      if (!cancelled) setDemo({ id: persona, inputs: file.inputs, rows: file.rows });
    });
    return () => {
      cancelled = true;
    };
  }, [persona]);

  useEffect(() => {
    if (persona) return;
    // localStorage is read here, after mount, never during render (CLAUDE.md). The state update is
    // deferred a microtask because react-hooks/set-state-in-effect rejects a synchronous one.
    const saved = loadInputs();
    queueMicrotask(() => setLiveInputs(saved));
    if (saved) ensureLoaded();
  }, [persona, ensureLoaded]);

  if (persona) {
    return demo && demo.id === persona
      ? { state: "ready", persona, inputs: demo.inputs, rows: demo.rows }
      : { state: "loading", demo: true };
  }
  if (liveInputs === undefined) return { state: "loading", demo: false };
  if (liveInputs === null) return { state: "noInputs" };
  switch (whoop.status) {
    case "ready":
      return { state: "ready", persona: null, inputs: liveInputs, rows: whoop.rows };
    case "notConnected":
      return { state: "notConnected" };
    case "error":
      return { state: "error", httpStatus: whoop.httpStatus };
    default:
      return { state: "loading", demo: false };
  }
}
