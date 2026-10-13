// Pure OAuth helpers. Credentials are passed in; this module never reads env vars.
// Logs carry endpoint labels and status codes only, never bodies, tokens or codes.
import { randomBytes, timingSafeEqual } from "node:crypto";

export const WHOOP_AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_SCOPES = "offline read:recovery read:cycles read:sleep";

const MIN_STATE_LENGTH = 8;

/** Short-lived httpOnly cookie that carries the state from /api/auth/login to the callback. */
export const OAUTH_STATE_COOKIE = {
  name: "whoop_oauth_state",
  options: {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/api/auth/callback",
    maxAge: 600, // seconds
  },
} as const;

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

/** Carries only an endpoint label and HTTP status, so it is safe to log. */
export class WhoopAuthError extends Error {
  readonly status: number;

  constructor(label: string, status: number) {
    super(`WHOOP ${label} failed with status ${status}`);
    this.name = "WhoopAuthError";
    this.status = status;
  }
}

/** 24 random bytes as base64url: exactly 32 URL-safe characters. */
export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(WHOOP_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WHOOP_SCOPES);
  url.searchParams.set("state", params.state);
  return url.toString();
}

/** True only when both values are present, long enough, and equal (constant-time). */
export function isValidState(
  cookieState: string | null | undefined,
  queryState: string | null | undefined,
): boolean {
  if (!cookieState || !queryState) return false;
  if (cookieState.length < MIN_STATE_LENGTH) return false;
  const a = Buffer.from(cookieState);
  const b = Buffer.from(queryState);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenSet> {
  // WHOOP's docs don't state the body format; a working public script uses form encoding.
  return postToken(
    "token exchange",
    {
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    },
    "form",
  );
}

export function refreshTokens(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  // WHOOP's docs show a JSON body for refresh.
  return postToken(
    "token refresh",
    {
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      scope: "offline",
    },
    "json",
  );
}

type BodyFormat = "form" | "json";

/** POSTs to the token endpoint; on 400 or 415, retries once with the other body format. */
async function postToken(
  label: string,
  params: Record<string, string>,
  firstFormat: BodyFormat,
): Promise<TokenSet> {
  let format = firstFormat;
  let res = await sendToken(params, format);
  console.info(`[whoop] ${label} (${format}) -> ${res.status}`);

  if (res.status === 400 || res.status === 415) {
    format = format === "form" ? "json" : "form";
    res = await sendToken(params, format);
    console.info(`[whoop] ${label} (${format}) -> ${res.status}`);
  }

  if (!res.ok) throw new WhoopAuthError(label, res.status);
  return parseTokenResponse(label, res);
}

function sendToken(params: Record<string, string>, format: BodyFormat): Promise<Response> {
  return fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type":
        format === "form" ? "application/x-www-form-urlencoded" : "application/json",
    },
    body: format === "form" ? new URLSearchParams(params).toString() : JSON.stringify(params),
  });
}

async function parseTokenResponse(label: string, res: Response): Promise<TokenSet> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WhoopAuthError(`${label} (unreadable response)`, res.status);
  }
  const { access_token, refresh_token, expires_in } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof access_token !== "string" ||
    typeof refresh_token !== "string" ||
    typeof expires_in !== "number"
  ) {
    throw new WhoopAuthError(`${label} (missing token fields)`, res.status);
  }
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: Date.now() + expires_in * 1000,
  };
}
