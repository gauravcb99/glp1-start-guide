// Writes persona A's engine results for the Phase 6 notebook cross-check:
// weekday means and counts, cycle counts, and P(d) point estimates (adjusted and raw).
// Output is deterministic and marked synthetic.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { analysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { personaConfig } from "@/config/personas";
import { computeProfile } from "@/lib/analysis/profile";
import { preDrugWeekdayMeans } from "@/lib/analysis/weekday";
import { generatePersona } from "@/lib/personas/generate";

const OUT = join("notebook", "data", "synthetic", "engine_results.json");

const seed = requireConfig(personaConfig, "seed");
const metrics = requireConfig(analysisConfig, "metricsShown");
const { inputs, rows } = generatePersona(personaConfig, "A", seed);

const results = metrics.map((metric) => {
  const baseline = preDrugWeekdayMeans(rows, inputs, metric, analysisConfig);
  const adjusted = computeProfile(rows, inputs, metric, "adjusted", analysisConfig);
  const raw = computeProfile(rows, inputs, metric, "raw", analysisConfig);
  return {
    metric,
    weekdayMeans: baseline.means, // index 0 = Sunday
    weekdayCounts: baseline.counts,
    cycles: adjusted.cycles,
    adjusted: adjusted.points.map((p) => p.estimate),
    raw: raw.points.map((p) => p.estimate),
  };
});

writeFileSync(
  OUT,
  `${JSON.stringify({ synthetic: true, persona: "A", seed, config: analysisConfig, results }, null, 2)}\n`,
);
console.log(`wrote ${OUT}`);
