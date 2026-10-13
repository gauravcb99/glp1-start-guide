"use client";

// Holds the member's WHOOP rows in memory (React state) for this browser session, shared by
// Week, Since, Setup and Debug so switching pages doesn't refetch. Never written to
// localStorage, sessionStorage, IndexedDB or cookies; gone on reload (CLAUDE.md rule 2).
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { analysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import type { DailyRow } from "@/lib/analysis/types";
import { queuedFetchJson } from "@/lib/whoop/browserQueue";

export type WhoopDataState =
  | { status: "idle" | "loading" }
  | { status: "ready"; rows: DailyRow[]; start: string; end: string }
  | { status: "notConnected" }
  | { status: "error"; httpStatus: number };

type WhoopData = {
  state: WhoopDataState;
  /** Starts the one fetch for this session, if it hasn't started yet. */
  ensureLoaded: () => void;
  /** Fetches again (the "Refresh data" button). */
  refresh: () => void;
};

const WhoopDataContext = createContext<WhoopData | null>(null);

export function WhoopDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WhoopDataState>({ status: "idle" });
  const started = useRef(false);

  const load = useCallback(() => {
    started.current = true;
    const historyDays = requireConfig(analysisConfig, "historyDaysToFetch");
    const today = new Date();
    const end = localYmd(today);
    const start = localYmd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - historyDays));
    setState({ status: "loading" });
    queuedFetchJson(`/api/whoop/days?start=${start}&end=${end}`)
      .then((res) => {
        if (res.status === 401) setState({ status: "notConnected" });
        else if (!res.ok) setState({ status: "error", httpStatus: res.status });
        else setState({ status: "ready", rows: res.body as DailyRow[], start, end });
      })
      .catch(() => setState({ status: "error", httpStatus: 0 }));
  }, []);

  const ensureLoaded = useCallback(() => {
    if (!started.current) load();
  }, [load]);

  const value = useMemo(() => ({ state, ensureLoaded, refresh: load }), [state, ensureLoaded, load]);
  return <WhoopDataContext.Provider value={value}>{children}</WhoopDataContext.Provider>;
}

export function useWhoopData(): WhoopData {
  const ctx = useContext(WhoopDataContext);
  if (!ctx) throw new Error("useWhoopData must be used inside WhoopDataProvider");
  return ctx;
}

function localYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
