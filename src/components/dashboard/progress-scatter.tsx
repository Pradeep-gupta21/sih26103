"use client";

import { useRouter } from "next/navigation";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ProgressDivergence, ProgressPoint } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";
import { CHART, tokenColor } from "./chart-theme";

/**
 * X = financial progress, Y = physical progress. On the dashed 45-degree line the two agree;
 * below it money has moved faster than work. The two groups are drawn as two series so the
 * colour is never the only carrier: the tooltip and the caption state the same thing.
 */
export function ProgressScatter({ data }: { data: ProgressDivergence }) {
  const router = useRouter();
  const below = data.points.filter((p) => p.financial_progress > p.physical_progress);
  const onOrAbove = data.points.filter((p) => p.financial_progress <= p.physical_progress);
  const open = (point: ProgressPoint) => router.push(`/projects/${encodeURIComponent(point.project_id)}`);
  const sampleNote = data.sampled ? `Showing ${formatIndian(data.points.length)} of ${formatIndian(data.total_points)} projects, stratified by sector.` : `Showing all ${formatIndian(data.total_points)} projects.`;
  const summary = `Scatter of financial progress against physical progress. ${sampleNote} Across the whole registry, ${formatIndian(data.below_line_total)} of ${formatIndian(data.total_points)} projects report financial progress ahead of physical progress; in this sample ${formatIndian(below.length)} of ${formatIndian(data.points.length)} do.`;
  return (
    <Panel eyebrow="EXECUTION" title="Physical versus financial progress" summary={summary} caption={<>{sampleNote} Points below the dashed line are projects where money has moved faster than work: <b>{formatIndian(data.below_line_total)}</b> of {formatIndian(data.total_points)} in the registry. Click a point to open the project.</>}>
      <div className="overview-chart overview-chart-square" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={tokenColor("--border-hairline")} />
            <XAxis type="number" dataKey="financial_progress" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={CHART.tick} axisLine={CHART.axisLine} tickLine={false} label={{ value: "Financial progress", position: "bottom", offset: 4, fill: "var(--text-muted)", fontSize: 10 }} />
            <YAxis type="number" dataKey="physical_progress" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" width={44} tick={CHART.tick} axisLine={CHART.axisLine} tickLine={false} label={{ value: "Physical progress", angle: -90, position: "insideLeft", offset: 12, fill: "var(--text-muted)", fontSize: 10 }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke={tokenColor("--text-muted")} strokeDasharray="4 4" ifOverflow="visible" />
            <Tooltip cursor={false} contentStyle={CHART.tooltip} content={({ payload }) => { const point = payload?.[0]?.payload as ProgressPoint | undefined; if (!point) return null; const lag = point.financial_progress > point.physical_progress; return <div className="overview-tooltip"><strong>{point.project_id}</strong><span>{point.sector}</span><span>Physical {formatIndian(point.physical_progress, 1)}% · Financial {formatIndian(point.financial_progress, 1)}%</span><em>{lag ? "Financial ahead of physical" : "Physical at or ahead of financial"}</em></div>; }} />
            <Scatter name="Physical at or ahead of financial" data={onOrAbove} fill={tokenColor("--chart-green-4")} fillOpacity={0.55} shape="circle" isAnimationActive={false} onClick={(item) => open(item.payload as ProgressPoint)} cursor="pointer" />
            <Scatter name="Financial ahead of physical" data={below} fill={tokenColor("--alert-critical")} fillOpacity={0.55} shape="circle" isAnimationActive={false} onClick={(item) => open(item.payload as ProgressPoint)} cursor="pointer" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="overview-legend" role="list"><span role="listitem"><i style={{ background: "var(--chart-green-4)" }} /> Physical at or ahead of financial</span><span role="listitem"><i style={{ background: "var(--alert-critical)" }} /> Financial ahead of physical</span><span role="listitem"><i className="dashed" /> Equal progress</span></div>
    </Panel>
  );
}
