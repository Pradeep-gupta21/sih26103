"use client";

import type { ReactNode } from "react";

/**
 * The one coloured status chip: severity, risk band, SLA verdict. Tone names map onto the
 * existing `.risk-pill.<tone>` rules; the word is always printed beside the dot so colour
 * is never the only carrier.
 */
export type ChipTone = "critical" | "high" | "moderate" | "stable" | "watch" | string;

export function StatusChip({ tone, className = "", children }: { tone: ChipTone; className?: string; children: ReactNode }) {
  return <span className={`risk-pill ${tone} ${className}`.trim()}><i />{children}</span>;
}
