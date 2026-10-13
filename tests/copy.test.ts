// Wording guard: applies CLAUDE.md "Wording" banned patterns to every user-facing string source.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strings } from "@/copy/strings";

const FILES = ["src/copy/strings.ts", "src/data/labelRanges.ts"];

// Exactly the regexes listed in CLAUDE.md, case-insensitive.
const BANNED: RegExp[] = [
  /\bcaus(e|es|ed|ing)\b/i,
  /\bdiagnos\w*/i,
  /\btreat(s|ed|ing)?\b/i,
  /\bnormal\b/i,
  /\babnormal\b/i,
  /\bsafe(ly)?\b/i,
  /\bdangerous\b/i,
  /side effects? detected/i,
  /\byou should\b/i,
  /(adjust|increase|decrease|change|skip|delay) (your|a|the) dose/i,
];

const PRESCRIBER_LINE = "If something here concerns you, it may be worth raising with your prescriber.";

describe("copy wording", () => {
  for (const file of FILES) {
    const text = readFileSync(file, "utf8");
    it.each(BANNED.map((r) => [r.source, r] as const))(`${file} has no match for /%s/`, (_, regex) => {
      const lines = text.split("\n").filter((line) => regex.test(line));
      expect(lines).toEqual([]);
    });
  }

  it("the regexes still catch what they are meant to", () => {
    for (const bad of ["this causes", "diagnosis", "treated", "Normal", "safely", "you should", "skip your dose"]) {
      expect(BANNED.some((r) => r.test(bad)), bad).toBe(true);
    }
    for (const ok of ["because", "treatment", "after a dose step", "usual week"]) {
      expect(BANNED.some((r) => r.test(ok)), ok).toBe(false);
    }
  });

  it("uses the exact footer", () => {
    expect(strings.footer).toBe("For general wellness and education. Not medical advice.");
  });

  it("mentions a prescriber only in the one allowed line", () => {
    expect(strings.prescriber).toBe(PRESCRIBER_LINE);
    for (const file of FILES) {
      const mentions = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => /prescriber/i.test(line));
      for (const line of mentions) expect(line).toContain(PRESCRIBER_LINE);
    }
  });
});
