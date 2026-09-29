"use client";

/** Loading placeholders sized to the element they stand in for, so nothing shifts when data arrives. */
export function PanelSkeleton({ className = "", height = 260 }: { className?: string; height?: number }) {
  return <section className={`card panel skeleton ${className}`.trim()} aria-hidden="true"><div className="panel-head"><div className="panel-head-text"><span className="skeleton-line" style={{ width: 220, height: 20 }} /><span className="skeleton-line" style={{ width: 300, height: 14 }} /></div></div><div className="panel-body"><div className="skeleton-block" style={{ height }} /></div></section>;
}

export function StatCardSkeleton() {
  return <div className="card stat-card skeleton" aria-hidden="true"><span className="skeleton-block" style={{ width: 36, height: 36, borderRadius: 10 }} /><span className="skeleton-line" style={{ width: 120, height: 15, marginTop: 20 }} /><span className="skeleton-line" style={{ width: 90, height: 32, marginTop: 8 }} /><span className="skeleton-line" style={{ width: 160, height: 14, marginTop: 12 }} /></div>;
}
