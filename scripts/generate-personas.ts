// Generates synthetic personas A, B and C from src/config/personas.ts.
// Output is deterministic (no timestamps, fixed key order) and every file is marked synthetic.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { requireConfig } from "@/config/errors";
import { personaConfig, type PersonaId } from "@/config/personas";
import type { DailyRow } from "@/lib/analysis/types";
import { generatePersona } from "@/lib/personas/generate";

const APP_DIR = join("src", "data", "personas");
const NOTEBOOK_DIR = join("notebook", "data", "synthetic");
const PERSONAS: PersonaId[] = ["A", "B", "C"];
const CSV_COLUMNS: (keyof DailyRow)[] = [
  "date",
  "cycleId",
  "restingHr",
  "hrvMs",
  "recovery",
  "sleepPerformance",
  "respiratoryRate",
  "skinTempC",
  "strain",
  "calibrating",
];

const seed = requireConfig(personaConfig, "seed");
mkdirSync(APP_DIR, { recursive: true });
mkdirSync(NOTEBOOK_DIR, { recursive: true });

for (const id of PERSONAS) {
  const { inputs, rows } = generatePersona(personaConfig, id, seed);
  const lower = id.toLowerCase();

  writeJson(join(APP_DIR, `persona-${lower}.json`), { synthetic: true, persona: id, seed, inputs, rows });
  writeJson(join(NOTEBOOK_DIR, `persona_${lower}_inputs.json`), { synthetic: true, persona: id, seed, inputs });
  writeFileSync(join(NOTEBOOK_DIR, `persona_${lower}.csv`), toCsv(rows));

  console.log(`persona ${id}: ${rows.length} rows, first dose ${inputs.firstDoseDate}`);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function toCsv(rows: DailyRow[]): string {
  const header = [...CSV_COLUMNS, "synthetic"].join(",");
  const lines = rows.map((row) =>
    [...CSV_COLUMNS.map((col) => (row[col] === null ? "" : String(row[col]))), "true"].join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}
