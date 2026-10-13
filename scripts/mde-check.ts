// Detectability check: the smallest within-week change the current analysis config can call
// "clear" for one person, simulated on persona B's noise with the engine's own estimator and
// the configured interval's critical value. See src/lib/analysis/mde.ts.
//
// Run: npx tsx scripts/mde-check.ts [seedCount]
// Default runs: personaConfig.mdeSeedCount. SE is the largest per-day SD across runs, which reads
// high with few runs (max of noisy estimates).
import { analysisConfig } from "@/config/analysis";
import { requireConfig } from "@/config/errors";
import { personaConfig } from "@/config/personas";
import { computeMde } from "@/lib/analysis/mde";

const arg = Number(process.argv[2]);
const count = Number.isInteger(arg) && arg > 1 ? arg : requireConfig(personaConfig, "mdeSeedCount");
const seeds = Array.from({ length: count }, (_, i) => i + 1);
const result = computeMde(personaConfig, analysisConfig, seeds);
const planted = requireConfig(personaConfig, "personas").A.plantedProfile;

console.log(
  `Persona B, ${result.runs} runs. Interval ${result.interval}, decision level ${result.decisionLevel.toFixed(5)}`,
);
console.log("MDE50 = critical × SE (just reaches the clear threshold; detected ~half the time)");
console.log("MDE80 = (critical + t_0.8) × SE (detected ~80% of the time)\n");
console.log("metric            sd    SE(sim)  SE(analytic)  df    crit   MDE50 (×sd)       MDE80 (×sd)");
for (const r of result.rows) {
  console.log(
    [
      r.metric.padEnd(16),
      r.noiseSd.toFixed(1).padStart(5),
      r.se.toFixed(3).padStart(9),
      r.seAnalytic.toFixed(3).padStart(13),
      (r.df === null ? "∞" : r.df.toFixed(1)).padStart(5),
      r.critical.toFixed(2).padStart(6),
      `${r.mde50.toFixed(2)} (${(r.mde50 / r.noiseSd).toFixed(2)})`.padStart(16),
      `${r.mde80.toFixed(2)} (${(r.mde80 / r.noiseSd).toFixed(2)})`.padStart(17),
    ].join(" "),
  );
}

console.log("\nPersona A planted values (non-zero) compared with MDE:");
let below = 0;
if (planted !== "none") {
  for (const r of result.rows) {
    planted[r.metric]?.forEach((value, d) => {
      if (value === 0) return;
      const size = Math.abs(value);
      const flag = size < r.mde50 ? "BELOW MDE50" : size < r.mde80 ? "below MDE80" : "ok";
      if (size < r.mde50) below++;
      console.log(`  ${r.metric.padEnd(16)} d=${d}  ${String(value).padStart(4)}  ${flag}`);
    });
  }
}
console.log(`\n${below} planted value(s) below MDE50.`);
