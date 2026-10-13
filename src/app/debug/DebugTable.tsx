"use client";

// Dev-only tool, never shown in production, so its labels live here rather than in strings.ts.
import { useEffect, useState } from "react";
import { analysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import type { DailyRow } from "@/lib/analysis/types";
import { queuedFetch } from "@/lib/whoop/browserQueue";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; start: string; end: string; rows: DailyRow[] };

const COLUMNS: (keyof DailyRow)[] = [
  "date",
  "cycleId",
  "restingHr",
  "hrvMs",
  "recovery",
  "sleepPerformance",
  "respiratoryRate",
  "skinTempC",
  "strain",
  "calibrating",
];

export function DebugTable() {
  let historyDays: number | null = null;
  let configError: string | null = null;
  try {
    historyDays = requireConfig(analysisConfig, "historyDaysToFetch");
  } catch (err) {
    configError = (err as Error).message;
  }

  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (historyDays === null) return;
    let cancelled = false;

    const today = new Date();
    const end = localYmd(today);
    const start = localYmd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - historyDays));

    queuedFetch(`/api/whoop/days?start=${start}&end=${end}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", message: `HTTP ${res.status}${body ? ` ${JSON.stringify(body)}` : ""}` });
          return;
        }
        setState({ kind: "ready", start, end, rows: body as DailyRow[] });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "Network error" });
      });

    return () => {
      cancelled = true;
    };
  }, [historyDays]);

  if (configError) return <p className="text-sm text-red-700">{configError}</p>;
  if (state.kind === "loading") return <p className="text-sm text-zinc-500">Loading WHOOP rows…</p>;
  if (state.kind === "error") return <p className="text-sm text-red-700">{state.message}</p>;

  const counts = new Map<string, number>();
  for (const row of state.rows) counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
  const duplicates = [...counts].filter(([, n]) => n > 1).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {state.rows.length} rows, {state.start} to {state.end}. Duplicate dates: {duplicates}
        {duplicates > 0 && " (highlighted)"}.
      </p>
      <div className="overflow-x-auto">
        <table className="text-left font-mono text-xs">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} className="border-b px-2 py-1">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => (
              <tr
                key={`${row.date}-${row.cycleId}`}
                className={(counts.get(row.date) ?? 0) > 1 ? "bg-amber-100" : undefined}
              >
                {COLUMNS.map((col) => (
                  <td key={col} className="border-b px-2 py-1">
                    {row[col] === null ? "—" : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function localYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
