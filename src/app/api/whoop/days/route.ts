export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("Not implemented", {
    status: 501,
    headers: { "Cache-Control": "no-store" },
  });
}
