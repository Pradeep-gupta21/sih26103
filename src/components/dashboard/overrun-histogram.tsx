"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OverrunBucket } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";
import { CHART, tokenColor } from "./chart-theme";

/**
 * Five fixed buckets of (project_age_months - planned_duration_months), in the order the API
 * returns them -- never re-sorted by count. Clicking a bucket carries its month bounds to
 * /projects, which filters on the same subtraction.
 */
export function OverrunHistogram({ buckets }: { buckets: OverrunBucket[] }) {
  const router = useRouter();
  const open = (bucket: OverrunBucket) => {
    const params = new URLSearchParams();
    if (bucket.min_months !== null) params.set("overrun_min", String(bucket.min_months));
    if (bucket.max_months !== null) params.set("overrun_max", String(bucket.max_months));
    params.set("overrun_label", bucket.bucket_label.toLowerCase());
    router.push(`/projects?${params.toString()}`);
  };
  const summary = `Schedule overrun distribution: ` + buckets.map((b) => `${b.bucket_label} ${formatIndian(b.project_count)} projects`).join("; ") + ".";
  return (
    <Panel eyebrow="TIMELINE" title="Schedule overrun distribution" summary={summary} caption="Project age minus planned duration, from the record itself. Click a bucket to list those projects.">
      <div className="overview-chart overview-chart-short" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 18, right: 8, bottom: 4, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={tokenColor("--border-hairline")} />
            <XAxis dataKey="bucket_label" tick={CHART.tick} axisLine={CHART.axisLine} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v: number) => formatIndian(v)} width={44} tick={CHART.tick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: tokenColor("--surface-hover") }} contentStyle={CHART.tooltip} formatter={(value) => [`${formatIndian(Number(value))} projects`, "Projects"]} />
            <Bar dataKey="project_count" fill={tokenColor("--chart-green-1")} isAnimationActive={false} cursor="pointer" onClick={(item) => open(item.payload as OverrunBucket)} label={{ position: "top", fill: tokenColor("--text-secondary"), fontSize: 10, formatter: (v: unknown) => formatIndian(Number(v)) }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="overview-chip-row" aria-label="Open an overrun range in the project list">
        {buckets.map((b) => <li key={b.bucket_key}><button className="overview-chip" onClick={() => open(b)}>{b.bucket_label} <b>{formatIndian(b.project_count)}</b></button></li>)}
      </ul>
    </Panel>
  );
}
