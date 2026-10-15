// Method and limits. Every result shown here is read from src/data/methodResults.json, which
// `npm run method-results` generates with the real engine and config on synthetic members.
// The README shows the same lines and table (scripts/readme-results.ts).
import { strings } from "@/copy/strings";
import { labelRanges, whoopStudy } from "@/data/labelRanges";
import results from "@/data/methodResults.json";
import { mdeTable, selfTestLines } from "@/lib/methodResults";

const m = strings.method;

export default function MethodPage() {
  const tests = selfTestLines(results);
  const table = mdeTable(results);

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
                  t.pass ? "bg-green-600/20 text-green-800 dark:text-green-300" : "bg-red-600/20 text-red-800 dark:text-red-300"
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
        <p className="text-secondary">{table.intro}</p>
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
              {table.rows.map((row) => (
                <tr key={row.metric} className="border-b border-border">
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 pr-4 tabular-nums">{row.noise}</td>
                  <td className="py-2 pr-4 tabular-nums">{row.half}</td>
                  <td className="py-2 tabular-nums">{row.most}</td>
                </tr>
              ))}
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
