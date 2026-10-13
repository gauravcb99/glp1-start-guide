import { NextResponse } from "next/server";
import { getAccessToken, getSession, isConnected } from "@/lib/session";
import { WhoopAuthError } from "@/lib/whoop/oauth";

export const dynamic = "force-dynamic";

/** Reports whether a usable WHOOP session exists. Refreshes the token if it is close to expiry. Never returns tokens. */
export async function GET() {
  const session = await getSession();
  if (!isConnected(session)) return status(false);

  try {
    await getAccessToken(session);
    return status(true);
  } catch (err) {
    if (err instanceof WhoopAuthError) {
      console.warn(`[whoop] status: ${err.message}`);
      // 400/401 mean the refresh token was rejected; anything else may be transient, so keep the session.
      if (err.status === 400 || err.status === 401) session.destroy();
    } else {
      console.warn("[whoop] status: token refresh failed");
    }
    return status(false);
  }
}

function status(connected: boolean) {
  return NextResponse.json({ connected }, { headers: { "Cache-Control": "no-store" } });
}
