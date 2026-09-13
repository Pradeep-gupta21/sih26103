"use client";

import type { ReactNode } from "react";

/**
 * The one coloured chip: severity, risk band, SLA verdict, rule tag. `critical` is the
 * only red; `warning` covers HIGH / MEDIUM / WARNING / MODERATE; everything else is a
 * neutral tint. The word is always printed, so colour is never the only carrier.
 */
export type ChipTone = "critical" | "warning" | "neutral";

/** Maps the tone names used across the API and older code onto the three chip tones. */
export function chipTone(value: string | null | undefined): ChipTone {
  const v = (value ?? "").toLowerCase();
  if (v === "critical") return "critical";
  if (v === "high" || v === "warning" || v === "moderate" || v === "medium" || v === "watch") return "warning";
  return "neutral";
}

export function StatusChip({ tone, className = "", children }: { tone: ChipTone | string; className?: string; children: ReactNode }) {
  const resolved: ChipTone = tone === "critical" || tone === "warning" || tone === "neutral" ? tone : chipTone(tone);
  return <span className={`chip chip-${resolved} ${className}`.trim()}>{children}</span>;
}
