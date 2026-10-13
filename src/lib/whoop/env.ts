import "server-only";

// The only module that reads WHOOP_CLIENT_SECRET. Errors name missing variables, never values.

export type ServerEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
};

const MIN_SESSION_SECRET_LENGTH = 32; // iron-session requirement

export function getServerEnv(): ServerEnv {
  const env = {
    WHOOP_CLIENT_ID: process.env.WHOOP_CLIENT_ID,
    WHOOP_CLIENT_SECRET: process.env.WHOOP_CLIENT_SECRET,
    WHOOP_REDIRECT_URI: process.env.WHOOP_REDIRECT_URI,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  if (env.SESSION_SECRET!.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return {
    clientId: env.WHOOP_CLIENT_ID!,
    clientSecret: env.WHOOP_CLIENT_SECRET!,
    redirectUri: env.WHOOP_REDIRECT_URI!,
    sessionSecret: env.SESSION_SECRET!,
  };
}
