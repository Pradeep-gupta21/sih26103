"use client";

import type { ReactNode } from "react";

/**
 * One flat overview panel: eyebrow, title, optional right-side slot, body, caption.
 * `summary` is read by screen readers in place of the chart it describes.
 */
export function Panel({ eyebrow, title, aside, caption, summary, className = "", children }: { eyebrow: string; title: string; aside?: ReactNode; caption?: ReactNode; summary: string; className?: string; children: ReactNode }) {
  return (
    <section className={`overview-panel ${className}`.trim()} aria-label={title}>
      <header className="overview-panel-head">
        <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
        {aside}
      </header>
      <p className="visually-hidden">{summary}</p>
      <div className="overview-panel-body">{children}</div>
      {caption && <p className="overview-panel-caption">{caption}</p>}
    </section>
  );
}

export function PanelSkeleton({ className = "", height = 260 }: { className?: string; height?: number }) {
  return <section className={`overview-panel overview-skeleton ${className}`.trim()} aria-hidden="true"><div className="overview-panel-head"><div><span className="skeleton-line" style={{ width: 90 }} /><span className="skeleton-line" style={{ width: 220, height: 14 }} /></div></div><div className="overview-panel-body"><div className="skeleton-block" style={{ height }} /></div></section>;
}
