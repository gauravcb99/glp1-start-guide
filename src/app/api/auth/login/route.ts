import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/whoop/env";
import { buildAuthorizeUrl, generateState, OAUTH_STATE_COOKIE } from "@/lib/whoop/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { clientId, redirectUri } = getServerEnv();
  const state = generateState();

  const res = NextResponse.redirect(buildAuthorizeUrl({ clientId, redirectUri, state }));
  res.cookies.set(OAUTH_STATE_COOKIE.name, state, OAUTH_STATE_COOKIE.options);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
