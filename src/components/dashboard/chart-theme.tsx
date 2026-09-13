"use client";

/**
 * Chart styling that reads the CSS variables declared in globals.css, so the charts follow
 * the same tokens as everything else. SVG presentation attributes accept `var()`, so the
 * series colours are passed through as variable references rather than resolved hex values.
 */

export function tokenColor(name: string): string {
  return `var(${name})`;
}

export const CHART = {
  tick: { fill: "var(--text-muted)", fontSize: 10 },
  axisLine: { stroke: "var(--border-hairline)" },
  legend: { fontSize: 10, color: "var(--text-secondary)", paddingBottom: 8 },
  tooltip: { background: "var(--surface-panel-raised)", border: "1px solid var(--border-strong)", borderRadius: 0, fontSize: 11, color: "var(--text-primary)", boxShadow: "none", padding: "8px 10px" },
};
