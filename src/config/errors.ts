export class ConfigNotSetError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Config value "${key}" is not set. Ask Gaurav to set it; do not pick a default.`);
    this.name = "ConfigNotSetError";
    this.key = key;
  }
}

/** Returns cfg[key], or throws ConfigNotSetError if it is null or undefined. */
export function requireConfig<T extends object, K extends keyof T>(
  cfg: T,
  key: K,
): NonNullable<T[K]> {
  const value = cfg[key];
  if (value === null || value === undefined) {
    throw new ConfigNotSetError(String(key));
  }
  return value as NonNullable<T[K]>;
}
