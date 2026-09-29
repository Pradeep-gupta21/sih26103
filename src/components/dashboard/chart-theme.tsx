"use client";

import type { ReactNode } from "react";

/**
 * Chart styling that reads the CSS variables declared in globals.css. SVG presentation
 * attributes accept `var()`, so series colours are passed as variable references. Charts
 * are neutral by default: brand green never appears in a chart, and red is used only
 * for points past a threshold or reference line.
 */
export const tokenColor = (name: string): string => `var(${name})`;

export const CHART = {
  tick: { fill: "var(--text-muted)", fontSize: 13 },
  tickMargin: 12,
  grid: "var(--chart-gridline)",
  strong: tokenColor("--chart-strong"),
  soft: tokenColor("--chart-soft"),
  neutral: tokenColor("--chart-neutral"),
  critical: tokenColor("--critical"),
  hoverFill: "var(--row-hover)",
};

/** The one tooltip layout: a bold header line, then one row per series with a swatch, label and right-aligned value. */
export function ChartTooltip({ title, rows, note }: { title: ReactNode; rows: { swatch?: string; label: string; value: string }[]; note?: string }) {
  return (
    <div className="chart-tooltip">
      <strong>{title}</strong>
      {rows.map((row) => <div className="row" key={row.label}>{row.swatch && <i style={{ background: row.swatch }} />}<span>{row.label}</span><b>{row.value}</b></div>)}
      {note && <em>{note}</em>}
    </div>
  );
}

export function ChartLegend({ items }: { items: { swatch?: string; dashed?: boolean; label: string }[] }) {
  return <div className="chart-legend" role="list">{items.map((item) => <span role="listitem" key={item.label}><i className={item.dashed ? "dashed" : undefined} style={item.swatch ? { background: item.swatch } : undefined} /> {item.label}</span>)}</div>;
}
