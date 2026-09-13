"use client";

import type { ReactNode } from "react";

/** Eyebrow, page title, exactly one subtitle line; page controls on the right. */
export function PageHeader({ eyebrow, title, subtitle, controls }: { eyebrow: string; title: string; subtitle: string; controls?: ReactNode }) {
  return <header className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{controls && <div className="page-head-controls">{controls}</div>}</header>;
}
