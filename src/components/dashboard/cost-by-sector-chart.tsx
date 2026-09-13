"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectorCost } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";
import { CHART, ChartLegend, ChartTooltip } from "./chart-theme";

const ROW_HEIGHT = 46;
const TOP = 6;

/** Sanctioned versus revised cost per sector. Shows the six largest by revised cost until expanded; a bar is a link to that sector's projects. */
export function CostBySectorChart({ rows, unit }: { rows: SectorCost[]; unit: string }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const ordered = [...rows].sort((a, b) => b.revised_cost_sum - a.revised_cost_sum);
  const shown = showAll ? ordered : ordered.slice(0, TOP);
  const open = (sector: string) => router.push(`/projects?sector=${encodeURIComponent(sector)}`);
  const summary = `Sanctioned versus revised cost by sector, in ${unit}: ` + rows.map((r) => `${r.sector} original ${formatIndian(r.original_cost_sum)}, revised ${formatIndian(r.revised_cost_sum)} across ${formatIndian(r.project_count)} projects`).join("; ") + ".";
  const height = Math.min(340, shown.length * ROW_HEIGHT + 40);
  return (
    <Panel title="Cost escalation by sector" subtitle={`Original sanction against revised cost, ${unit}. Click a bar to open the sector.`} info="The difference is escalation already recorded in the registry, not a forecast. Sectors are ordered by revised cost." summary={summary} className="span-8"
      controls={rows.length > TOP && <button type="button" className={`pill${showAll ? " is-active" : ""}`} onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>{showAll ? `Top ${TOP} sectors` : "Show all sectors"}</button>}>
      <ChartLegend items={[{ swatch: CHART.soft, label: "Original sanction" }, { swatch: CHART.strong, label: "Revised cost" }]} />
      <div className="chart" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={shown} layout="vertical" margin={{ top: 0, right: 80, bottom: 0, left: 0 }} barCategoryGap={12} barGap={2}>
            <CartesianGrid vertical={false} horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => formatIndian(v)} tick={CHART.tick} tickMargin={CHART.tickMargin} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="sector" width={150} tick={CHART.tick} tickMargin={CHART.tickMargin} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: CHART.hoverFill }} content={({ payload }) => { const row = payload?.[0]?.payload as SectorCost | undefined; if (!row) return null; return <ChartTooltip title={row.sector} rows={[{ swatch: CHART.soft, label: "Original sanction", value: `${formatIndian(row.original_cost_sum)} ${unit}` }, { swatch: CHART.strong, label: "Revised cost", value: `${formatIndian(row.revised_cost_sum)} ${unit}` }, { label: "Projects", value: formatIndian(row.project_count) }]} />; }} />
            <Bar dataKey="original_cost_sum" fill={CHART.soft} radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(item) => open((item.payload as SectorCost).sector)} />
            <Bar dataKey="revised_cost_sum" fill={CHART.strong} radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(item) => open((item.payload as SectorCost).sector)} label={{ position: "right", fill: "var(--text-secondary)", fontSize: 13, formatter: (v: unknown) => formatIndian(Number(v)) }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
