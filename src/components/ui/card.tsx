"use client";

import type { HTMLAttributes, ReactNode } from "react";

/** The one panel surface. `accent` adds the 3px brand rule down the left edge; `tint` fills with brand tint (used for active-filter banners). */
export function Card({ accent = false, tint = false, className = "", children, ...rest }: HTMLAttributes<HTMLElement> & { accent?: boolean; tint?: boolean; children: ReactNode }) {
  return <section {...rest} className={`card${accent ? " card-accent" : ""}${tint ? " card-tint" : ""} ${className}`.trim()}>{children}</section>;
}
