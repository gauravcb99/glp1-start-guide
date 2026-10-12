import { describe, expect, it } from "vitest";
import { ConfigNotSetError, requireConfig } from "@/config/errors";

describe("requireConfig", () => {
  const cfg: { a: string | null; b: string | null } = { a: "set", b: null };

  it("returns a value that is set", () => {
    expect(requireConfig(cfg, "a")).toBe("set");
  });

  it("throws ConfigNotSetError naming the key when the value is null", () => {
    expect(() => requireConfig(cfg, "b")).toThrow(ConfigNotSetError);
    expect(() => requireConfig(cfg, "b")).toThrow(/"b"/);
  });
});
