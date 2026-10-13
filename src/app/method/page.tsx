// Method and limits. Every result shown here is read from src/data/methodResults.json, which
// `npm run method-results` generates with the real engine and config on synthetic members.
import { strings } from "@/copy/strings";
import { labelRanges, whoopStudy } from "@/data/labelRanges";
import results from "@/data/methodResults.json";

const m = strings.method;

export default function MethodPage() {
  const { selfTests, mde, maxFalsePatternRate } = results;
  const maxPct = Math.round(maxFalsePatternRate * 100);
  const worst = Math.max(...selfTests.planted.map((p) => p.maxErrorInNoiseSd));
  const tolerance = selfTests.planted[0].toleranceInNoiseSd;

  const tests = [
    { text: m.selfTests.planted(worst.toFixed(2), tolerance.toFixed(1)), pass: worst <= tolerance },
    {
      text: m.selfTests.null(selfTests.null.clear, selfTests.null.runs, maxPct),
      pass: selfTests.null.clear / selfTests.null.runs <= maxFalsePatternRate,
    },
    {
      text: m.selfTests.placebo(selfTests.placebo.clear, selfTests.placebo.runs, maxPct),
      pass: selfTests.placebo.clear / selfTests.placebo.runs <= maxFalsePatternRate,
    },
    {
      text: m.selfTests.trap(
        selfTests.weekdayTrap.habitD,
        selfTests.weekdayTrap.rawClearAtHabitDay,
        selfTests.weekdayTrap.adjustedClear,
      ),
      pass: selfTests.weekdayTrap.rawClearAtHabitDay && !selfTests.weekdayTrap.adjustedClear,
    },
  ];

  const cycles = Math.round(mde.rows[0].cycles);
  const preWeeks = Math.round(mde.rows[0].preWeeks);
  const fmt = (v: number, unit: string) => `${v.toFixed(1)} ${unit}`;

  const sources = [
    { name: labelRanges.tirzepatide.hrSourceName, url: labelRanges.tirzepatide.hrSourceUrl },
    { name: labelRanges.semaglutide.hrSourceName, url: labelRanges.semaglutide.hrSourceUrl },
    { name: labelRanges.semaglutide.halfLifeSourceName, url: labelRanges.semaglutide.halfLifeSourceUrl },
    { name: whoopStudy.sourceName, url: whoopStudy.sourceUrl },
    { name: m.whoopApi, url: "https://developer.whoop.com/api" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{m.title}</h1>
        <p className="text-secondary">{m.intro}</p>
      </header>

      <Section title={m.stepsTitle}>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-secondary">
          {m.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>

      <Section title={m.selfTestsTitle}>
        <p className="text-secondary">{m.selfTestsIntro}</p>
        <ul className="flex flex-col gap-2">
          {tests.map((t) => (
            <li key={t.text} className="flex gap-3">
              <span
                className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  t.pass ? "bg-green-600/20 text-green-500" : "bg-red-600/20 text-red-500"
                }`}
              >
                {t.pass ? m.selfTests.pass : m.selfTests.fail}
              </span>
              <span className="text-secondary">{t.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={m.mdeTitle}>
        <p className="text-secondary">{m.mdeIntro(mde.runs, cycles, preWeeks)}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{m.mdeColumns.metric}</th>
                <th className="py-2 pr-4 font-medium">{m.mdeColumns.noise}</th>
                <th className="py-2 pr-4 font-medium">{m.mdeColumns.half}</th>
                <th className="py-2 font-medium">{m.mdeColumns.most}</th>
              </tr>
            </thead>
            <tbody>
              {mde.rows.map((row) => {
                const metric = strings.metrics[row.metric as keyof typeof strings.metrics];
                return (
                  <tr key={row.metric} className="border-b border-border">
                    <td className="py-2 pr-4">{metric.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmt(row.noiseSd, metric.sentenceUnit)}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmt(row.mde50, metric.sentenceUnit)}</td>
                    <td className="py-2 tabular-nums">{fmt(row.mde80, metric.sentenceUnit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={m.intervalTitle}>
        {m.intervalBody.map((p) => (
          <p key={p} className="text-secondary">
            {p}
          </p>
        ))}
      </Section>

      <Section title={m.limitsTitle}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-secondary">
          {m.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </Section>

      <Section title={m.sourcesTitle}>
        <ul className="flex flex-col gap-1 text-sm">
          {sources.map((s) => (
            <li key={s.url + s.name}>
              <a href={s.url} className="underline" target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
