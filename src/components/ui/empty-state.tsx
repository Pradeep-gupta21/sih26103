"use client";

import type { ReactNode } from "react";

/** Muted icon, one heading, one line of guidance, optionally one action. Never placeholder rows. */
export function EmptyState({ icon, title, hint, action, compact = false }: { icon: ReactNode; title: string; hint: string; action?: ReactNode; compact?: boolean }) {
  return <div className={`empty-state${compact ? " compact" : ""}`}><span className="empty-icon" aria-hidden="true">{icon}</span><strong>{title}</strong><p>{hint}</p>{action}</div>;
}
