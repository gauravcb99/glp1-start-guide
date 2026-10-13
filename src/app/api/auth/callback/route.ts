import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getServerEnv } from "@/lib/whoop/env";
import {
  exchangeCode,
  isValidState,
  OAUTH_STATE_COOKIE,
  WhoopAuthError,
} from "@/lib/whoop/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE.name)?.value;
  cookieStore.delete({ name: OAUTH_STATE_COOKIE.name, path: OAUTH_STATE_COOKIE.options.path });

  if (params.has("error")) {
    console.warn("[whoop] callback: authorization was not granted");
    return redirectTo(request, "/?connect=failed");
  }
  if (!code || !isValidState(expectedState, params.get("state"))) {
    console.warn("[whoop] callback: missing code or state check failed");
    return redirectTo(request, "/?connect=failed");
  }

  const { clientId, clientSecret, redirectUri } = getServerEnv();
  try {
    const tokens = await exchangeCode({ code, clientId, clientSecret, redirectUri });
    const session = await getSession();
    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;
    session.expiresAt = tokens.expiresAt;
    await session.save();
  } catch (err) {
    // WhoopAuthError messages hold only a label and status code.
    console.warn(
      err instanceof WhoopAuthError ? `[whoop] callback: ${err.message}` : "[whoop] callback: token exchange failed",
    );
    return redirectTo(request, "/?connect=failed");
  }

  return redirectTo(request, "/setup");
}

function redirectTo(request: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
