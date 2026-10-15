// README.md's generated blocks (method steps, self-test results, detection table, limits) must
// match what the Method page shows. If this fails, run `npm run readme`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillReadme, README, renderBlocks } from "../scripts/readme-results";

describe("README", () => {
  const readme = readFileSync(README, "utf8");

  it("generated blocks are up to date with methodResults.json and strings.ts", () => {
    expect(fillReadme(readme)).toBe(readme);
  });

  it("has every generated block", () => {
    for (const name of Object.keys(renderBlocks())) {
      expect(readme).toContain(`<!-- ${name}:start -->`);
      expect(readme).toContain(`<!-- ${name}:end -->`);
    }
  });

  it("names environment variables without values", () => {
    for (const line of readme.split("\n")) {
      expect(line).not.toMatch(/\b(WHOOP_CLIENT_ID|WHOOP_CLIENT_SECRET|SESSION_SECRET)\s*=\s*\S/);
    }
  });
});
