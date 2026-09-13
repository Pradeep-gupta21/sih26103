"use client";

import type { ReactNode } from "react";

/**
 * The "nothing here yet / choose something first" panel used by the scenario, settings,
 * saved-analyses and no-project screens. Same markup those pages rendered inline.
 */
export function EmptyState({ icon, eyebrow, title, children, actions }: { icon: ReactNode; eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <section className="signal-panel state-page-panel"><div className="signal-icon">{icon}</div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3>{children}{actions}</section>;
}
