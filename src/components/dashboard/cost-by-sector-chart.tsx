"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectorCost } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";
import { CHART, tokenColor } from "./chart-theme";

const ROW_HEIGHT = 46;

export function CostBySectorChart({ rows, unit }: { rows: SectorCost[]; unit: string }) {
  const router = useRouter();
  const open = (sector: string) => router.push(`/projects?sector=${encodeURIComponent(sector)}`);
  const summary = `Sanctioned versus revised cost by sector, in ${unit}: ` + rows.map((r) => `${r.sector} original ${formatIndian(r.original_cost_sum)}, revised ${formatIndian(r.revised_cost_sum)} across ${formatIndian(r.project_count)} projects`).join("; ") + ".";
  return (
    <Panel eyebrow="FINANCIAL" title="Cost escalation by sector" summary={summary} className="overview-panel-full" caption={<>Sum of sanctioned versus revised cost per sector, in {unit}. Difference is committed escalation already recorded, not forecast. Click a sector to open its projects.</>}>
      <div className="overview-chart" style={{ height: rows.length * ROW_HEIGHT + 60 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 8 }} barCategoryGap={12} barGap={2}>
            <CartesianGrid horizontal={false} stroke={tokenColor("--border-hairline")} />
            <XAxis type="number" tickFormatter={(v: number) => formatIndian(v)} tick={CHART.tick} axisLine={CHART.axisLine} tickLine={false} />
            <YAxis type="category" dataKey="sector" width={140} tick={CHART.tick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: tokenColor("--surface-hover") }} contentStyle={CHART.tooltip} formatter={(value, name) => [`${formatIndian(Number(value))} ${unit}`, name === "original_cost_sum" ? "Original sanction" : "Revised cost"]} labelFormatter={(label) => String(label)} />
            <Legend verticalAlign="top" align="right" iconType="square" iconSize={9} wrapperStyle={CHART.legend} formatter={(value: string) => value === "original_cost_sum" ? "Original sanction" : "Revised cost"} />
            <Bar dataKey="original_cost_sum" fill={tokenColor("--chart-green-5")} stroke={tokenColor("--chart-green-3")} strokeWidth={1} isAnimationActive={false} cursor="pointer" onClick={(item) => open((item.payload as SectorCost).sector)} />
            <Bar dataKey="revised_cost_sum" fill={tokenColor("--chart-green-1")} isAnimationActive={false} cursor="pointer" onClick={(item) => open((item.payload as SectorCost).sector)} label={{ position: "right", fill: tokenColor("--text-secondary"), fontSize: 10, formatter: (v: unknown) => formatIndian(Number(v)) }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="overview-chip-row" aria-label="Open sector in the project list">
        {rows.map((r) => <li key={r.sector}><button className="overview-chip" onClick={() => open(r.sector)}>{r.sector} <b>{formatIndian(r.project_count)}</b></button></li>)}
      </ul>
    </Panel>
  );
}
