"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * One headline figure: icon chip, one-line label, value with inline unit, one-line caption.
 * No delta, arrow or percentage badge -- the registry is a snapshot with no history.
 * Only `tone="critical"` colours the value; everything else is text_primary.
 */
export function StatCard({ icon, label, value, unit, caption, href, tone }: { icon: ReactNode; label: string; value: string; unit?: string; caption: string; href?: string; tone?: "critical" }) {
  const router = useRouter();
  const body = <>
    <span className="icon-chip" aria-hidden="true">{icon}</span>
    <span className="stat-label">{label}</span>
    <strong className={`stat-value${tone === "critical" ? " is-critical" : ""}`}>{value}{unit && <small>{unit}</small>}</strong>
    <span className="stat-caption">{caption}</span>
  </>;
  return href
    ? <button type="button" className="card stat-card stat-card-link" onClick={() => router.push(href)} aria-label={`${label}: ${value}${unit ? ` ${unit}` : ""}. ${caption}. Open`}>{body}</button>
    : <div className="card stat-card">{body}</div>;
}
