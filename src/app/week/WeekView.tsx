"use client";

import { useMemo, useState } from "react";
import { MemberGate, type ReadyData } from "@/components/MemberGate";
import { Notice } from "@/components/Notice";
import { WeekChart } from "@/components/WeekChart";
import { analysisConfig as cfg } from "@/config/analysis";
import { strings } from "@/copy/strings";
import { analyzeWeek, decisionLevel } from "@/lib/analysis/profile";
import { summarize } from "@/lib/analysis/summary";
import type { Profile, View, WeekAnalysis } from "@/lib/analysis/types";

const w = strings.week;
const n = strings.notices;

export function WeekView() {
  return <MemberGate>{(data) => <WeekBody data={data} />}</MemberGate>;
}

function WeekBody({ data }: { data: ReadyData }) {
  const [view, setView] = useState<View>("adjusted");
  const [rawRequested, setRawRequested] = useState(false);

  // Adjusted is computed up front; raw only once it's first asked for. Both stay for the session.
  const adjusted = useMemo(() => analyzeWeek(data.rows, data.inputs, "adjusted", cfg), [data.rows, data.inputs]);
  const raw = useMemo(
    () => (rawRequested ? analyzeWeek(data.rows, data.inputs, "raw", cfg) : null),
    [rawRequested, data.rows, data.inputs],
  );
  const analysis = view === "raw" && raw ? raw : adjusted;

  const choose = (next: View) => {
    if (next === "raw") setRawRequested(true);
    setView(next);
  };

  const offset = cfg.dayZeroRule![data.inputs.injectionTime];
  const metrics = cfg.metricsShown!.length;
  const levelPct = (decisionLevel(cfg) * 100).toFixed(2);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{w.title}</h1>
        <p className="text-secondary">{w.intro}</p>
      </header>

      <div role="group" aria-label="View" className="inline-flex w-fit rounded-full border border-border p-1 text-sm">
        {(["adjusted", "raw"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => choose(v)}
            aria-pressed={view === v}
            className={`rounded-full px-4 py-1.5 ${view === v ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
          >
            {v === "adjusted" ? w.toggleAdjusted : w.toggleRaw}
          </button>
        ))}
      </div>

      <PageState analysis={analysis}>
        <section className="rounded-xl border border-border bg-surface px-5 py-4">
          <h2 className="text-sm font-medium text-muted">{w.summaryTitle}</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {summarize(analysis).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-1 text-sm text-secondary">
          <p>{view === "raw" ? w.rawNote : w.adjustedNote}</p>
          <p>{w.relativeNote}</p>
          <p>
            {w.dayZero(offset, data.inputs.injectionTime)} {w.cycles(analysis.profiles[0].cycles)}
          </p>
          <p>{w.clearExplainer(7, metrics, levelPct)}</p>
          <p>{w.legend}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {analysis.profiles.map((profile) => (
            <MetricCard key={profile.metric} profile={profile} />
          ))}
        </div>

        <p className="text-sm text-muted">{strings.prescriber}</p>
      </PageState>
    </div>
  );
}

/** Page-level friendly state when every metric is short of data in the same way. */
function PageState({ analysis, children }: { analysis: WeekAnalysis; children: React.ReactNode }) {
  const statuses = new Set(analysis.profiles.map((p) => p.status));
  if (statuses.size === 1 && statuses.has("notEnoughPreDrugData")) {
    const window = cfg.preDrugWindow!;
    return (
      <Notice
        title={n.notEnoughPreDrug.title}
        body={n.notEnoughPreDrug.body(cfg.minPreDrugWeeksPerWeekday!, window.kind === "lastWeeks" ? window.weeks : null)}
      />
    );
  }
  if (statuses.size === 1 && statuses.has("notEnoughCycles")) {
    return <Notice title={n.notEnoughCycles.title(analysis.profiles[0].cycles, cfg.minCycles!)} body={n.notEnoughCycles.body} />;
  }
  return <>{children}</>;
}

function MetricCard({ profile }: { profile: Profile }) {
  const { name, unit } = strings.metrics[profile.metric];
  return (
    <section className="rounded-xl border border-border px-4 pb-2 pt-4">
      <h2 className="font-medium">
        {name} <span className="text-sm font-normal text-muted">({unit})</span>
      </h2>
      {profile.status === "ok" ? (
        <WeekChart profile={profile} />
      ) : (
        <p className="py-6 text-sm text-muted">{strings.summary.metricNotEnough(name)}</p>
      )}
    </section>
  );
}
