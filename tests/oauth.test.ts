import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCode,
  generateState,
  isValidState,
  refreshTokens,
  WHOOP_SCOPES,
  WhoopAuthError,
} from "@/lib/whoop/oauth";

// Dummy values only; no real credentials or env.
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret-should-never-leak";
const REDIRECT_URI = "https://localhost:3000/api/auth/callback";
const CODE = "test-auth-code-should-never-leak";

describe("buildAuthorizeUrl", () => {
  const state = "a".repeat(32);
  const url = new URL(buildAuthorizeUrl({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI, state }));

  it("targets the WHOOP authorize endpoint", () => {
    expect(url.origin).toBe("https://api.prod.whoop.com");
    expect(url.pathname).toBe("/oauth/oauth2/auth");
  });

  it("sets the required query params", () => {
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(url.searchParams.get("state")).toBe(state);
  });

  it("requests exactly the offline, recovery, cycles and sleep scopes, space-separated", () => {
    expect(WHOOP_SCOPES).toBe("offline read:recovery read:cycles read:sleep");
    expect(url.searchParams.get("scope")).toBe(WHOOP_SCOPES);
    expect(url.search).not.toContain(" ");
  });
});

describe("generateState", () => {
  it("returns 32 URL-safe characters", () => {
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("differs between calls", () => {
    expect(generateState()).not.toBe(generateState());
  });
});

describe("isValidState", () => {
  const state = generateState();

  it("accepts a matching state", () => {
    expect(isValidState(state, state)).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(isValidState(state, generateState())).toBe(false);
  });

  it("rejects a missing cookie or query value", () => {
    expect(isValidState(undefined, state)).toBe(false);
    expect(isValidState(state, null)).toBe(false);
    expect(isValidState("", "")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(isValidState(state, state.slice(0, -1))).toBe(false);
  });

  it("rejects states shorter than 8 characters even when equal", () => {
    expect(isValidState("abc1234", "abc1234")).toBe(false);
  });
});

describe("token endpoint body format", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const logs: string[] = [];

  const tokenBody = { access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 };
  const ok = () => new Response(JSON.stringify(tokenBody), { status: 200 });
  const fail = (status: number) => new Response("{}", { status });
  const contentTypes = () =>
    fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get("Content-Type"));

  beforeEach(() => {
    fetchMock.mockReset();
    logs.length = 0;
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation((...args) => void logs.push(args.join(" ")));
    vi.spyOn(console, "warn").mockImplementation((...args) => void logs.push(args.join(" ")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const exchange = () =>
    exchangeCode({ code: CODE, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI });

  it("exchanges the code with a form body first, uncached", async () => {
    fetchMock.mockResolvedValueOnce(ok());
    const tokens = await exchange();
    expect(tokens.accessToken).toBe("new-access");
    expect(tokens.refreshToken).toBe("new-refresh");
    expect(contentTypes()).toEqual(["application/x-www-form-urlencoded"]);
    expect(fetchMock.mock.calls[0][1]?.cache).toBe("no-store");
  });

  it("retries once with JSON when the form body gets a 400", async () => {
    fetchMock.mockResolvedValueOnce(fail(400)).mockResolvedValueOnce(ok());
    await exchange();
    expect(contentTypes()).toEqual(["application/x-www-form-urlencoded", "application/json"]);
  });

  it("refreshes with a JSON body first and falls back to form on 415", async () => {
    fetchMock.mockResolvedValueOnce(fail(415)).mockResolvedValueOnce(ok());
    await refreshTokens({ refreshToken: "old-refresh", clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
    expect(contentTypes()).toEqual(["application/json", "application/x-www-form-urlencoded"]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      grant_type: "refresh_token",
      scope: "offline",
    });
  });

  it("does not retry on 401", async () => {
    fetchMock.mockResolvedValueOnce(fail(401));
    await expect(exchange()).rejects.toBeInstanceOf(WhoopAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never puts the secret or code in errors or logs", async () => {
    fetchMock.mockResolvedValueOnce(fail(400)).mockResolvedValueOnce(fail(400));
    const err = await exchange().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WhoopAuthError);
    expect((err as WhoopAuthError).status).toBe(400);

    const text = [String(err), ...logs].join("\n");
    expect(logs.length).toBeGreaterThan(0);
    expect(text).not.toContain(CLIENT_SECRET);
    expect(text).not.toContain(CODE);
  });

  it("rejects a response without a refresh token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "a", expires_in: 3600 }), { status: 200 }),
    );
    await expect(exchange()).rejects.toBeInstanceOf(WhoopAuthError);
  });
});
