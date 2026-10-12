// Server-only. Every fetch uses cache: 'no-store'. Log status codes and endpoint names only.

/** Paginated GET (limit 25, follows next_token), backing off on 429. Record shapes are typed in Phase 2. */
export async function whoopGetAll(
  _path: string,
  _params: { start: string; end: string },
  _accessToken: string,
): Promise<unknown[]> {
  throw new Error("Not implemented: Phase 2");
}
