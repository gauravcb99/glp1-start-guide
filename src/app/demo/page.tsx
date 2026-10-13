import Link from "next/link";
import { requireConfig } from "@/config/errors";
import { personaConfig, type PersonaId } from "@/config/personas";
import { strings } from "@/copy/strings";
import { weekdayIndex } from "@/lib/personas/generate";
import { withDemo } from "@/lib/personas/load";

const d = strings.demo;

export default function DemoPage() {
  const personas = requireConfig(personaConfig, "personas");
  const body = (id: PersonaId) => {
    const p = personas[id];
    const drug = strings.drugs[p.drug];
    const weekday = strings.weekdays[weekdayIndex(p.injectionWeekday)];
    if (id === "C" && p.weeklyHabit !== "none") {
      return d.personas.C.body(drug, weekday, strings.weekdays[weekdayIndex(p.weeklyHabit.night)]);
    }
    return id === "A" ? d.personas.A.body(drug, weekday) : d.personas.B.body(drug, weekday);
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
        <p className="text-secondary">{d.intro}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {(["A", "B", "C"] as const).map((id) => (
          <Link
            key={id}
            href={withDemo("/week", id)}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 hover:border-series"
          >
            <span className="w-fit rounded-full bg-badge px-2.5 py-0.5 text-xs font-medium text-badge-text">
              {strings.nav.syntheticBadge}
            </span>
            <h2 className="font-medium">{d.personas[id].title}</h2>
            <p className="text-sm text-secondary">{body(id)}</p>
            <span className="mt-auto text-sm font-medium text-series">{d.open}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
