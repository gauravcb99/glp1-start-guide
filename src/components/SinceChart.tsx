"use client";

// Rolling level vs the pre-drug usual: a muted "before first dose" segment, the line since the
// first dose, dashed dose-step markers, and (resting HR only) the label's trial-average band.
// A visually hidden sentence gives the latest level for screen readers.
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { strings } from "@/copy/strings";
import { toMs } from "@/lib/analysis/dates";
import type { LongViewPoint, Metric } from "@/lib/analysis/types";

type Datum = { t: number; pre: number | null; post: number | null; n: number };

const s = strings.since;
const shortDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function SinceChart({
  metric,
  pre,
  post,
  doseSteps,
  referenceBand,
}: {
  metric: Metric;
  pre: LongViewPoint[];
  post: LongViewPoint[];
  doseSteps: { date: string; mg: number }[];
  referenceBand: { low: number; high: number } | null;
}) {
  const unit = strings.metrics[metric].sentenceUnit; // a difference in % is points
  const data: Datum[] = [
    ...pre.map((p) => ({ t: toMs(p.date), pre: p.rollingAdjusted, post: null, n: p.n })),
    ...post.map((p) => ({ t: toMs(p.date), pre: null, post: p.rollingAdjusted, n: p.n })),
  ];
  if (data.length === 0) return null;
  const firstDoseT = post.length > 0 ? toMs(post[0].date) : data[data.length - 1].t;
  const lastT = data[data.length - 1].t;
  const latest = [...post].reverse().find((p) => p.rollingAdjusted !== null);

  return (
    <>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[data[0].t, lastT]}
              tickFormatter={shortDate}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--grid)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={44}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              label={{ value: unit, angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11, dx: 10 }}
            />
            {referenceBand && (
              <ReferenceArea
                x1={firstDoseT}
                x2={lastT}
                y1={referenceBand.low}
                y2={referenceBand.high}
                fill="var(--reference-fill)"
                fillOpacity={0.18}
                stroke="none"
                ifOverflow="extendDomain"
              />
            )}
            <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
            {pre.length > 0 && (
              <ReferenceLine
                x={toMs(pre[0].date)}
                stroke="none"
                label={{ value: s.beforeFirstDose, position: "insideTopLeft", fill: "var(--text-muted)", fontSize: 11 }}
              />
            )}
            {doseSteps.map((step) => (
              <ReferenceLine
                key={step.date}
                x={toMs(step.date)}
                stroke="var(--text-muted)"
                strokeDasharray="2 4"
                label={{ value: s.doseStep(step.mg), position: "insideTopRight", fill: "var(--text-muted)", fontSize: 10 }}
              />
            ))}
            <Tooltip content={<SinceTooltip unit={unit} />} />
            <Line dataKey="pre" stroke="var(--series-muted)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line dataKey="post" stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {latest && (
        <p className="sr-only">
          {s.latestLevel(
            strings.metrics[metric].name,
            shortDate(toMs(latest.date)),
            `${latest.rollingAdjusted! > 0 ? "+" : ""}${latest.rollingAdjusted!.toFixed(1)} ${unit}`,
          )}
        </p>
      )}
    </>
  );
}

function SinceTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Datum }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const value = p.pre ?? p.post;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow">
      <p className="font-medium">{shortDate(p.t)}</p>
      <p className="text-secondary">
        {s.tooltipValue}: {value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)} ${unit}`}
      </p>
      <p className="text-secondary">{s.tooltipDays(p.n)}</p>
      <p className="text-secondary">{p.pre !== null ? s.beforeFirstDose : s.afterFirstDose}</p>
    </div>
  );
}
