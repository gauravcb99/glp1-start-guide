// Fills the generated blocks in README.md from the same sources as the Method page:
// the method steps and known limits (src/copy/strings.ts) and the self-test results and
// detectability table (src/data/methodResults.json). Numbers are never typed into the README by hand.
// tests/readme.test.ts fails if README.md is out of date. Run: npm run readme
import { readFileSync, writeFileSync } from "node:fs";
import { strings } from "@/copy/strings";
import results from "@/data/methodResults.json";
import { mdeTable, selfTestLines, type MethodResults } from "@/lib/methodResults";

export const README = "README.md";

const m = strings.method;

/** Generated block contents, keyed by marker name. */
export function renderBlocks(r: MethodResults = results): Record<string, string> {
  const table = mdeTable(r);
  return {
    "method-steps": m.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    "method-results": [
      ...selfTestLines(r).map((t) => `- **${t.pass ? m.selfTests.pass : m.selfTests.fail}:** ${t.text}`),
      "",
      `**${m.mdeTitle}.** ${table.intro}`,
      "",
      `| ${m.mdeColumns.metric} | ${m.mdeColumns.noise} | ${m.mdeColumns.half} | ${m.mdeColumns.most} |`,
      "| --- | --- | --- | --- |",
      ...table.rows.map((row) => `| ${row.name} | ${row.noise} | ${row.half} | ${row.most} |`),
    ].join("\n"),
    "method-limits": m.limits.map((limit) => `- ${limit}`).join("\n"),
  };
}

/** README text with every generated block replaced. Throws if a marker pair is missing. */
export function fillReadme(readme: string, blocks: Record<string, string> = renderBlocks()): string {
  let out = readme;
  for (const [name, body] of Object.entries(blocks)) {
    const start = `<!-- ${name}:start -->`;
    const end = `<!-- ${name}:end -->`;
    const a = out.indexOf(start);
    const b = out.indexOf(end);
    if (a === -1 || b === -1 || b < a) throw new Error(`README.md is missing the ${name} markers`);
    out = `${out.slice(0, a + start.length)}\n${body}\n${out.slice(b)}`;
  }
  return out;
}

if (process.argv[1]?.endsWith("readme-results.ts")) {
  writeFileSync(README, fillReadme(readFileSync(README, "utf8")));
  console.log(`updated ${README}`);
}
