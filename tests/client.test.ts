import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhoopApiError, whoopGetAll } from "@/lib/whoop/client";

const TOKEN = "test-access-token-should-never-leak";
const RANGE = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-31T23:59:59.000Z" };

describe("whoopGetAll", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const logs: string[] = [];
  const page = (records: unknown[], next_token?: string) =>
    new Response(JSON.stringify({ records, next_token }), { status: 200 });
  const urls = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)));

  beforeEach(() => {
    fetchMock.mockReset();
    logs.length = 0;
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation((...args) => void logs.push(args.join(" ")));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("follows next_token across pages with limit 25, uncached", async () => {
    fetchMock.mockResolvedValueOnce(page([{ id: 1 }, { id: 2 }], "tok-2")).mockResolvedValueOnce(page([{ id: 3 }]));

    const records = await whoopGetAll<{ id: number }>("/v2/cycle", RANGE, TOKEN);

    expect(records.map((r) => r.id)).toEqual([1, 2, 3]);
    const [first, second] = urls();
    expect(first.origin + first.pathname).toBe("https://api.prod.whoop.com/developer/v2/cycle");
    expect(first.searchParams.get("limit")).toBe("25");
    expect(first.searchParams.get("start")).toBe(RANGE.start);
    expect(first.searchParams.get("end")).toBe(RANGE.end);
    expect(first.searchParams.has("nextToken")).toBe(false);
    expect(second.searchParams.get("nextToken")).toBe("tok-2");
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("backs off and retries on 429", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(page([{ id: 1 }]));

    const result = whoopGetAll("/v2/recovery", RANGE, TOKEN);
    await vi.advanceTimersByTimeAsync(1000); // default first backoff
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(2); // honours Retry-After: 3
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up with the 429 status after the retries run out", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => new Response("{}", { status: 429 }));
    const result = whoopGetAll("/v2/cycle", RANGE, TOKEN).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000);
    const err = await result;
    expect(err).toBeInstanceOf(WhoopApiError);
    expect((err as WhoopApiError).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("fails with the status code on other errors, without retrying", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const err = await whoopGetAll("/v2/activity/sleep", RANGE, TOKEN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WhoopApiError);
    expect((err as WhoopApiError).status).toBe(500);
    expect((err as WhoopApiError).endpoint).toBe("/v2/activity/sleep");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops if WHOOP repeats a next_token", async () => {
    fetchMock.mockImplementation(async () => page([{ id: 1 }], "same"));
    await expect(whoopGetAll("/v2/cycle", RANGE, TOKEN)).rejects.toBeInstanceOf(WhoopApiError);
  });

  it("logs endpoint and status only, never the token or records", async () => {
    fetchMock.mockResolvedValueOnce(page([{ resting_heart_rate: 54321 }]));
    await whoopGetAll("/v2/recovery", RANGE, TOKEN);
    expect(logs).toEqual(["[whoop] GET /v2/recovery -> 200"]);
  });
});
