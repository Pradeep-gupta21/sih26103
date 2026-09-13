"use client";

import type { ReactNode } from "react";

/**
 * The 73px bar above every page. Markup is exactly what each page rendered inline before
 * the extraction: an optional mobile brand, the breadcrumb (optional prefix + bold title),
 * and whatever action buttons the page passes in. Page-specific state (notification pop,
 * search panel) stays with the page that owns it.
 */
export function TopBar({ title, before, mobileBrand, actions }: { title: string; before?: ReactNode; mobileBrand?: ReactNode; actions?: ReactNode }) {
  return <header className="topbar">{mobileBrand && <div className="mobile-brand">{mobileBrand}</div>}<div className="breadcrumb">{before}<strong>{title}</strong></div>{actions && <div className="top-actions">{actions}</div>}</header>;
}
