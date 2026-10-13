"use client";

// Dev-only tool, never shown in production, so its labels live here rather than in strings.ts.
import { useEffect } from "react";
import { useWhoopData } from "@/components/WhoopDataProvider";
import type { DailyRow } from "@/lib/analysis/types";

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

/** Reads the session's rows from WhoopDataProvider, so a page load makes at most one request. */
export function DebugTable() {
  const { state, ensureLoaded, refresh } = useWhoopData();

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  if (state.status === "idle" || state.status === "loading") {
    return <p className="text-sm text-muted">Loading WHOOP rows…</p>;
  }
  if (state.status === "notConnected") return <p className="text-sm text-red-500">HTTP 401: not connected</p>;
  if (state.status === "error") return <p className="text-sm text-red-500">HTTP {state.httpStatus}</p>;
  if (state.status !== "ready") return null;

  const counts = new Map<string, number>();
  for (const row of state.rows) counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
  const duplicates = [...counts].filter(([, n]) => n > 1).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {state.rows.length} rows, {state.start} to {state.end}. Duplicate dates: {duplicates}
        {duplicates > 0 && " (highlighted)"}.{" "}
        <button type="button" onClick={refresh} className="underline">
          Refetch
        </button>
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
                className={(counts.get(row.date) ?? 0) > 1 ? "bg-amber-500/30" : undefined}
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
