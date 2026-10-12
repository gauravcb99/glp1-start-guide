// Server-only: reads WHOOP_CLIENT_SECRET. Never import from a client component.

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

export function buildAuthorizeUrl(_state: string): string {
  throw new Error("Not implemented: Phase 1");
}

export async function exchangeCode(_code: string): Promise<TokenSet> {
  throw new Error("Not implemented: Phase 1");
}

export async function refreshTokens(_refreshToken: string): Promise<TokenSet> {
  throw new Error("Not implemented: Phase 1");
}
