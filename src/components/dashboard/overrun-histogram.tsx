"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OverrunBucket } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";
import { CHART, ChartTooltip } from "./chart-theme";

/**
 * Five fixed buckets of (project_age_months - planned_duration_months), in the order the API
 * returns them -- never re-sorted by count. Clicking a bar carries its month bounds to
 * /projects, which filters on the same subtraction.
 */
/** Axis tick that breaks a bucket label onto two lines so five labels fit a five-column panel. */
function WrappedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = String(payload?.value ?? "").split(" ");
  const mid = Math.ceil(words.length / 2);
  const lines = words.length > 1 ? [words.slice(0, mid).join(" "), words.slice(mid).join(" ")] : [words[0]];
  return <text x={x} y={y} textAnchor="middle" fill="var(--text-muted)" fontSize={13}>{lines.map((line, i) => <tspan key={line} x={x} dy={i === 0 ? 12 : 15}>{line}</tspan>)}</text>;
}

export function OverrunHistogram({ buckets, medianMonths, overrunningProjects }: { buckets: OverrunBucket[]; medianMonths: number; overrunningProjects: number }) {
  const router = useRouter();
  const open = (bucket: OverrunBucket) => {
    const params = new URLSearchParams();
    if (bucket.min_months !== null) params.set("overrun_min", String(bucket.min_months));
    if (bucket.max_months !== null) params.set("overrun_max", String(bucket.max_months));
    params.set("overrun_label", bucket.bucket_label.toLowerCase());
    router.push(`/projects?${params.toString()}`);
  };
  const summary = `Schedule overrun distribution: ` + buckets.map((b) => `${b.bucket_label} ${formatIndian(b.project_count)} projects`).join("; ") + `. Median overrun ${formatIndian(medianMonths, 1)} months over ${formatIndian(overrunningProjects)} overrunning projects.`;
  return (
    <Panel title="Schedule overrun distribution" subtitle="Project age minus planned duration. Click a bar to list those projects." info="Measured from the record itself: project_age_months minus planned_duration_months, in whole months. Buckets are fixed and shown in month order." summary={summary} className="span-5">
      <p className="panel-annotation">Median overrun <b>{formatIndian(medianMonths, 1)} months</b> across {formatIndian(overrunningProjects)} overrunning projects.</p>
      <div className="chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 24, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="bucket_label" tick={<WrappedTick />} tickMargin={CHART.tickMargin} axisLine={false} tickLine={false} interval={0} height={44} />
            <YAxis tickFormatter={(v: number) => formatIndian(v)} width={48} tick={CHART.tick} tickMargin={CHART.tickMargin} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: CHART.hoverFill }} content={({ payload }) => { const b = payload?.[0]?.payload as OverrunBucket | undefined; if (!b) return null; return <ChartTooltip title={b.bucket_label} rows={[{ swatch: CHART.neutral, label: "Projects", value: formatIndian(b.project_count) }]} />; }} />
            <Bar dataKey="project_count" fill={CHART.neutral} radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={(item) => open(item.payload as OverrunBucket)} label={{ position: "top", fill: "var(--text-secondary)", fontSize: 13, formatter: (v: unknown) => formatIndian(Number(v)) }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
