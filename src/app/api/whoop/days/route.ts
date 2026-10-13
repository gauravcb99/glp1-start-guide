import { NextResponse, type NextRequest } from "next/server";
import type { DailyRow } from "@/lib/analysis/types";
import { getAccessToken, getSession, isConnected } from "@/lib/session";
import { WhoopApiError, whoopGetAll } from "@/lib/whoop/client";
import { normalizeDays } from "@/lib/whoop/normalize";
import { WhoopAuthError } from "@/lib/whoop/oauth";
import type { WhoopCycle, WhoopRecovery, WhoopSleep } from "@/lib/whoop/types";

// Fetches and normalizes on every request. Nothing is stored, cached or logged beyond status codes.
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /api/whoop/days?start=YYYY-MM-DD&end=YYYY-MM-DD -> DailyRow[] dated by wake morning. */
export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  if (!isDate(start) || !isDate(end) || start > end) {
    return json({ error: "start and end must be YYYY-MM-DD with start <= end" }, 400);
  }

  const session = await getSession();
  if (!isConnected(session)) return json({ error: "not connected" }, 401);

  let accessToken: string;
  try {
    accessToken = await getAccessToken(session); // at most one refresh for this request
  } catch (err) {
    if (err instanceof WhoopAuthError && (err.status === 400 || err.status === 401)) {
      console.warn(`[whoop] days: ${err.message}`);
      session.destroy();
      return json({ error: "not connected" }, 401);
    }
    console.warn("[whoop] days: token refresh failed");
    return json({ error: "token refresh failed" }, 502);
  }

  // Pad a day each side so a sleep that starts the evening before `start` still joins.
  const range = {
    start: new Date(Date.parse(`${start}T00:00:00Z`) - DAY_MS).toISOString(),
    end: new Date(Date.parse(`${end}T23:59:59Z`) + DAY_MS).toISOString(),
  };

  try {
    const [cycles, recoveries, sleeps] = await Promise.all([
      whoopGetAll<WhoopCycle>("/v2/cycle", range, accessToken),
      whoopGetAll<WhoopRecovery>("/v2/recovery", range, accessToken),
      whoopGetAll<WhoopSleep>("/v2/activity/sleep", range, accessToken),
    ]);
    const { rows } = normalizeDays(cycles, recoveries, sleeps);
    return json(
      rows.filter((row) => row.date >= start && row.date <= end),
      200,
    );
  } catch (err) {
    if (err instanceof WhoopApiError) {
      console.warn(`[whoop] days: ${err.message}`);
      return json(
        { error: "whoop", endpoint: err.endpoint, status: err.status },
        err.status === 401 ? 401 : 502,
      );
    }
    console.warn("[whoop] days: normalize failed");
    return json({ error: "could not read WHOOP data" }, 502);
  }
}

function isDate(value: string | null): value is string {
  return value !== null && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function json(body: DailyRow[] | Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
