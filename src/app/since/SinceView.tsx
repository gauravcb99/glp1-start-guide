"use client";

import { useMemo } from "react";
import { MemberGate, type ReadyData } from "@/components/MemberGate";
import { Notice } from "@/components/Notice";
import { SinceChart } from "@/components/SinceChart";
import { analysisConfig as cfg } from "@/config/analysis";
import { strings } from "@/copy/strings";
import { labelRanges, whoopStudy } from "@/data/labelRanges";
import { computeLongView, computePreDrugView } from "@/lib/analysis/longView";

const s = strings.since;
const n = strings.notices;

export function SinceView() {
  return <MemberGate>{(data) => <SinceBody data={data} />}</MemberGate>;
}

function SinceBody({ data }: { data: ReadyData }) {
  const metrics = cfg.metricsShown!;
  const views = useMemo(
    () =>
      metrics.map((metric) => ({
        metric,
        post: computeLongView(data.rows, data.inputs, metric, cfg),
        pre: computePreDrugView(data.rows, data.inputs, metric, cfg),
      })),
    [metrics, data.rows, data.inputs],
  );
  const label = labelRanges[data.inputs.drug];

  const header = (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
      <p className="text-secondary">{s.intro(cfg.rollingWindowDays!)}</p>
    </header>
  );

  if (views.every((v) => v.post.status !== "ok")) {
    const window = cfg.preDrugWindow!;
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Notice
          title={n.notEnoughPreDrug.title}
          body={n.notEnoughPreDrug.body(cfg.minPreDrugWeeksPerWeekday!, window.kind === "lastWeeks" ? window.weeks : null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <p className="text-sm text-secondary">
        {s.legend} {s.doseStepsNote}
      </p>

      <div className="flex flex-col gap-6">
        {views.map(({ metric, post, pre }) => {
          const { name, unit } = strings.metrics[metric];
          const isRestingHr = metric === "restingHr";
          return (
            <section key={metric} className="rounded-xl border border-border px-4 pb-3 pt-4">
              <h2 className="font-medium">
                {name} <span className="text-sm font-normal text-muted">({s.yAxis(unit)})</span>
              </h2>
              {post.status === "ok" ? (
                <SinceChart
                  metric={metric}
                  pre={pre.points}
                  post={post.points}
                  doseSteps={post.doseSteps}
                  referenceBand={isRestingHr ? label.restingHrIncreaseBpm : null}
                />
              ) : (
                <p className="py-6 text-sm text-muted">{strings.summary.metricNotEnough(name)}</p>
              )}
              {isRestingHr && (
                <div className="mt-2 flex flex-col gap-1 text-sm text-secondary">
                  <p>{s.labelBand(label.restingHrIncreaseBpm.low, label.restingHrIncreaseBpm.high)}</p>
                  <p>
                    {s.labelSource}{" "}
                    <a href={label.hrSourceUrl} className="underline" target="_blank" rel="noopener noreferrer">
                      {label.hrSourceName}
                    </a>
                  </p>
                  <p>
                    {s.whoopStudy(whoopStudy.members, whoopStudy.restingHrChangeBpm, whoopStudy.hrvChangeMs)}{" "}
                    <a href={whoopStudy.sourceUrl} className="underline" target="_blank" rel="noopener noreferrer">
                      {whoopStudy.sourceName}
                    </a>
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-sm text-secondary">{s.ownBaselineOnly}</p>
      <p className="text-sm text-muted">{strings.prescriber}</p>
    </div>
  );
}
