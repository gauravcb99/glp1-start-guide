// Server-only. Encrypted iron-session cookie holding WHOOP tokens (Phase 1).

export type SessionData = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
};
