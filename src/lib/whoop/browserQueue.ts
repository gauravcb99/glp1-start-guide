// Browser-side: runs requests to our WHOOP-touching routes one at a time per tab.
// A token refresh invalidates the old refresh token, so two parallel requests could each
// try to refresh with the same one. Queued, each request carries the cookie the previous
// response saved. This also covers React Strict Mode running effects twice in dev.
// Known limit: separate tabs are not coordinated.

let tail: Promise<unknown> = Promise.resolve();

export function queuedFetch(url: string): Promise<Response> {
  const run = tail.then(() => fetch(url, { cache: "no-store" }));
  tail = run.catch(() => undefined);
  return run;
}
