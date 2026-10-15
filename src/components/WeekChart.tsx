"use client";

// One metric's P(d): a dot per day with its 95% band, a zero line at the weekly average, and
// clear days marked with a filled dot plus a text label (never color alone). A visually hidden
// table carries the same values for screen readers.
import { Bar, CartesianGrid, ComposedChart, LabelList, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { strings } from "@/copy/strings";
import type { Profile } from "@/lib/analysis/types";

type Datum = {
  d: number;
  estimate: number;
  /** [lower, upper] of the 95% band, drawn as a thin range bar. */
  band: [number, number];
  lower: number;
  upper: number;
  clear: boolean;
};

const w = strings.week;

export function WeekChart({ profile }: { profile: Profile }) {
  const unit = strings.metrics[profile.metric].sentenceUnit; // a difference in % is points
  const data: Datum[] = profile.points
    .filter((p) => p.estimate !== null && p.band !== null)
    .map((p) => ({
      d: p.d,
      estimate: p.estimate!,
      band: [p.band!.lower, p.band!.upper],
      lower: p.band!.lower,
      upper: p.band!.upper,
      clear: profile.clearDays.includes(p.d),
    }));

  const ticks = niceTicks(Math.min(0, ...data.map((x) => x.lower)), Math.max(0, ...data.map((x) => x.upper)));

  const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} ${unit}`;

  return (
    <>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="d"
              type="category"
              tickFormatter={(d: number) => w.dayLabel(d)}
              interval={0}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--grid)" }}
              tickLine={false}
            />
            <YAxis
              width={44}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              label={{ value: unit, angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11, dx: 10 }}
            />
            <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
            <Tooltip cursor={false} content={<WeekTooltip unit={unit} />} />
            <Bar dataKey="band" barSize={4} fill="var(--series-1)" fillOpacity={0.35} radius={2} isAnimationActive={false} />
            <Scatter dataKey="estimate" isAnimationActive={false} shape={<Dot />}>
              <LabelList dataKey="clear" content={<ClearLabel />} />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* sr-only on a wrapper: a table ignores the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{w.table.caption(strings.metrics[profile.metric].name)}</caption>
          <thead>
            <tr>
              <th scope="col">{w.table.day}</th>
              <th scope="col">{w.table.average}</th>
              <th scope="col">{w.table.band}</th>
              <th scope="col">{w.table.clear}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.d}>
                <th scope="row">{w.dayLabel(p.d)}</th>
                <td>{fmt(p.estimate)}</td>
                <td>
                  {fmt(p.lower)} to {fmt(p.upper)}
                </td>
                <td>{p.clear ? w.table.yes : w.table.no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Dot(props: { cx?: number; cy?: number; payload?: Datum }) {
  const { cx = 0, cy = 0, payload } = props;
  const clear = payload?.clear;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={clear ? "var(--series-1)" : "var(--background)"}
      stroke="var(--series-1)"
      strokeWidth={2}
    />
  );
}

function ClearLabel(props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown; index?: number }) {
  if (props.value !== true) return null;
  const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
  return (
    <text x={x} y={12} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">
      {w.clearMark}
    </text>
  );
}

function WeekTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Datum }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} ${unit}`;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow">
      <p className="font-medium">{w.dayLabel(p.d)}</p>
      <p className="text-secondary">
        {w.tooltip.estimate}: {fmt(p.estimate)}
      </p>
      <p className="text-secondary">
        {w.tooltip.band}: {fmt(p.lower)} to {fmt(p.upper)}
      </p>
      <p className="text-secondary">{p.clear ? w.tooltip.clear : w.tooltip.notClear}</p>
    </div>
  );
}

/** Round tick steps (1, 2, 2.5 or 5 × 10^k) covering [lo, hi], always including zero. */
function niceTicks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 4 || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((x) => x >= raw)!;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
}
