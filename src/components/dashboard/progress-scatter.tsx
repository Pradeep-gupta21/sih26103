"use client";

import { useRouter } from "next/navigation";
import { ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ProgressDivergence, ProgressPoint } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";
import { CHART, ChartLegend, ChartTooltip } from "./chart-theme";

/**
 * X = financial progress, Y = physical progress. On the dashed 45-degree line the two agree;
 * below it money has moved faster than work. The two groups are two series so the colour is
 * never the only carrier: the tooltip and the legend say the same thing. The sample is the
 * API's stratified sample; the size shown is the real size.
 */
/** Small dot at a fixed radius; Recharts hands over cx/cy and the series fill. */
function Dot(props: { cx?: number; cy?: number; fill?: string }) { return <circle cx={props.cx} cy={props.cy} r={3} fill={props.fill} fillOpacity={0.45} />; }

export function ProgressScatter({ data }: { data: ProgressDivergence }) {
  const router = useRouter();
  const below = data.points.filter((p) => p.financial_progress > p.physical_progress);
  const onOrAbove = data.points.filter((p) => p.financial_progress <= p.physical_progress);
  const open = (point: ProgressPoint) => router.push(`/projects/${encodeURIComponent(point.project_id)}`);
  const sampleNote = data.sampled ? `Stratified sample of ${formatIndian(data.points.length)} of ${formatIndian(data.total_points)} projects.` : `All ${formatIndian(data.total_points)} projects.`;
  const summary = `Scatter of financial progress against physical progress. ${sampleNote} Across the whole registry, ${formatIndian(data.below_line_total)} of ${formatIndian(data.total_points)} projects report financial progress ahead of physical progress; in this sample ${formatIndian(below.length)} of ${formatIndian(data.points.length)} do.`;
  return (
    <Panel title="Physical versus financial progress" subtitle={`${formatIndian(data.below_line_total)} of ${formatIndian(data.total_points)} projects report money ahead of work.`} info="Points below the dashed line are projects whose financial progress exceeds physical progress. Click a point to open the project." summary={summary} className="span-7">
      <ChartLegend items={[{ swatch: CHART.neutral, label: "Physical at or ahead of financial" }, { swatch: CHART.critical, label: "Financial ahead of physical" }, { dashed: true, label: "Equal progress" }]} />
      <div className="chart" style={{ height: 340 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <XAxis type="number" dataKey="financial_progress" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={CHART.tick} tickMargin={CHART.tickMargin} axisLine={false} tickLine={false} label={{ value: "Financial progress", position: "bottom", offset: 8, fill: "var(--text-muted)", fontSize: 13 }} />
            <YAxis type="number" dataKey="physical_progress" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" width={64} tick={CHART.tick} tickMargin={CHART.tickMargin} axisLine={false} tickLine={false} label={{ value: "Physical progress", angle: -90, position: "insideLeft", offset: 4, fill: "var(--text-muted)", fontSize: 13 }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--text-muted)" strokeDasharray="4 4" ifOverflow="visible" />
            <Tooltip cursor={false} content={({ payload }) => { const point = payload?.[0]?.payload as ProgressPoint | undefined; if (!point) return null; const lag = point.financial_progress > point.physical_progress; return <ChartTooltip title={point.project_id} rows={[{ label: "Sector", value: point.sector }, { label: "Physical", value: `${formatIndian(point.physical_progress, 1)}%` }, { label: "Financial", value: `${formatIndian(point.financial_progress, 1)}%` }]} note={lag ? "Financial ahead of physical" : "Physical at or ahead of financial"} />; }} />
            <Scatter name="Physical at or ahead of financial" data={onOrAbove} fill={CHART.neutral} fillOpacity={0.45} shape={Dot} isAnimationActive={false} onClick={(item) => open(item.payload as ProgressPoint)} />
            <Scatter name="Financial ahead of physical" data={below} fill={CHART.critical} fillOpacity={0.45} shape={Dot} isAnimationActive={false} onClick={(item) => open(item.payload as ProgressPoint)} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="panel-annotation" style={{ margin: "12px 0 0" }}>{sampleNote}</p>
    </Panel>
  );
}
