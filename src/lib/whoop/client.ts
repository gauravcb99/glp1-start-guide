import "server-only";

import type { WhoopCollection } from "./types";

// Every fetch uses cache: 'no-store'. Logs carry endpoint names and status codes only.

export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer";
export type WhoopEndpoint = "/v2/cycle" | "/v2/recovery" | "/v2/activity/sleep";

const PAGE_LIMIT = 25; // WHOOP maximum
const BACKOFF_MS = [1000, 2000, 4000, 8000]; // waits between retries on 429

/** Carries only the endpoint and HTTP status, so it is safe to log and return. */
export class WhoopApiError extends Error {
  readonly endpoint: WhoopEndpoint;
  readonly status: number;

  constructor(endpoint: WhoopEndpoint, status: number, detail?: string) {
    super(`WHOOP GET ${endpoint} failed with status ${status}${detail ? ` (${detail})` : ""}`);
    this.name = "WhoopApiError";
    this.endpoint = endpoint;
    this.status = status;
  }
}

/** Fetches every page of a WHOOP collection between start and end (ISO date-times). */
export async function whoopGetAll<T>(
  endpoint: WhoopEndpoint,
  range: { start: string; end: string },
  accessToken: string,
): Promise<T[]> {
  const records: T[] = [];
  const seenTokens = new Set<string>();
  let nextToken: string | undefined;

  do {
    const url = new URL(WHOOP_API_BASE + endpoint);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("start", range.start);
    url.searchParams.set("end", range.end);
    if (nextToken) url.searchParams.set("nextToken", nextToken);

    const res = await getWithBackoff(url, endpoint, accessToken);
    const body = (await res.json()) as WhoopCollection<T>;
    records.push(...(body.records ?? []));

    nextToken = body.next_token || undefined;
    if (nextToken) {
      if (seenTokens.has(nextToken)) throw new WhoopApiError(endpoint, res.status, "repeated next_token");
      seenTokens.add(nextToken);
    }
  } while (nextToken);

  return records;
}

async function getWithBackoff(
  url: URL,
  endpoint: WhoopEndpoint,
  accessToken: string,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.info(`[whoop] GET ${endpoint} -> ${res.status}`);
    if (res.ok) return res;

    if (res.status === 429 && attempt < BACKOFF_MS.length) {
      await wait(retryAfterMs(res) ?? BACKOFF_MS[attempt]);
      continue;
    }
    throw new WhoopApiError(endpoint, res.status);
  }
}

/** Retry-After in seconds, if WHOOP sends it as a number. */
function retryAfterMs(res: Response): number | undefined {
  const seconds = Number(res.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
