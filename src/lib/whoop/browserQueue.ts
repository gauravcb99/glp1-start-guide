// Browser-side: runs requests to our WHOOP-touching routes one at a time per tab, and shares
// identical requests that are already in flight.
// - Queued: a token refresh invalidates the old refresh token, so two parallel requests could each
//   try to refresh with the same one. Queued, each request carries the cookie the previous response saved.
// - Shared: a second call for the same URL while the first is pending gets the same result instead
//   of sending another request. This covers React Strict Mode running effects twice in dev.
// Results are not kept after they settle. Known limit: separate tabs are not coordinated.

export type QueuedResult = { ok: boolean; status: number; body: unknown };

let tail: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<QueuedResult>>();

export function queuedFetchJson(url: string): Promise<QueuedResult> {
  const pending = inFlight.get(url);
  if (pending) return pending;

  const run = tail.then(async () => {
    const res = await fetch(url, { cache: "no-store" });
    const body: unknown = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  });
  tail = run.catch(() => undefined);

  const shared = run.finally(() => inFlight.delete(url));
  inFlight.set(url, shared);
  return shared;
}
