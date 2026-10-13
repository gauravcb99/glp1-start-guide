import "server-only";

import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/whoop/env";
import { refreshTokens } from "@/lib/whoop/oauth";

// Encrypted httpOnly cookie holding WHOOP tokens. Use only in route handlers:
// Server Components can't set cookies, so they can't save a refreshed token.

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

export type Session = IronSession<SessionData>;

const SESSION_COOKIE = "glp1_session";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Call once per request; getAccessToken dedupes refreshes per session object. */
export async function getSession(): Promise<Session> {
  const { sessionSecret } = getServerEnv();
  return getIronSession<SessionData>(await cookies(), {
    password: sessionSecret,
    cookieName: SESSION_COOKIE,
    onUnsealError: (reason) => {
      if (reason !== "expired") console.warn(`[session] cookie rejected: ${reason}`);
    },
  });
}

export function isConnected(session: Session): boolean {
  return typeof session.refreshToken === "string";
}

const inFlight = new WeakMap<Session, Promise<string>>();

/** Returns a valid access token, refreshing at most once per request (per session object). */
export function getAccessToken(session: Session): Promise<string> {
  let pending = inFlight.get(session);
  if (!pending) {
    pending = resolveAccessToken(session);
    inFlight.set(session, pending);
  }
  return pending;
}

async function resolveAccessToken(session: Session): Promise<string> {
  if (!session.refreshToken) throw new Error("Not connected to WHOOP");

  if (
    session.accessToken &&
    session.expiresAt !== undefined &&
    session.expiresAt - Date.now() > REFRESH_MARGIN_MS
  ) {
    return session.accessToken;
  }

  const { clientId, clientSecret } = getServerEnv();
  const tokens = await refreshTokens({
    refreshToken: session.refreshToken,
    clientId,
    clientSecret,
  });
  // Refreshing invalidates the old refresh token, so save the newest one.
  session.accessToken = tokens.accessToken;
  session.refreshToken = tokens.refreshToken;
  session.expiresAt = tokens.expiresAt;
  await session.save();
  return tokens.accessToken;
}
