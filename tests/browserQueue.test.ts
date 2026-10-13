import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queuedFetchJson } from "@/lib/whoop/browserQueue";

describe("queuedFetchJson", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shares one request between identical calls made while it is pending", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ connected: true }), { status: 200 }));
    const [a, b] = await Promise.all([queuedFetchJson("/api/auth/status"), queuedFetchJson("/api/auth/status")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ ok: true, status: 200, body: { connected: true } });
    expect(b).toBe(a);
  });

  it("sends a new request once the previous one has settled", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    await queuedFetchJson("/api/auth/status");
    await queuedFetchJson("/api/auth/status");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("runs different requests one after another, not in parallel", async () => {
    let active = 0;
    let maxActive = 0;
    fetchMock.mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return new Response("{}", { status: 200 });
    });
    await Promise.all([queuedFetchJson("/api/auth/status"), queuedFetchJson("/api/whoop/days?start=a&end=b")]);
    expect(maxActive).toBe(1);
    expect(fetchMock.mock.calls[0][1]?.cache).toBe("no-store");
  });

  it("returns the status and a null body for a non-JSON error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 502 }));
    expect(await queuedFetchJson("/api/whoop/days?start=x&end=y")).toEqual({ ok: false, status: 502, body: null });
  });
});
