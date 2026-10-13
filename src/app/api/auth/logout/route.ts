import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST only, so a link or prefetch can't sign the member out.
export async function POST(request: NextRequest) {
  const session = await getSession();
  session.destroy();

  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
