"use client";

import type { KeyboardEvent, ReactNode } from "react";

/**
 * The one list layout: a header row of sentence-case labels, then 56px-min rows on a
 * hairline divider. Columns give the grid template; numeric columns right-align.
 * A row with `onClick` is keyboard-operable (Enter / Space) and shows the hover state.
 */
export type Column = { key: string; label: ReactNode; width?: string; align?: "left" | "right"; srOnly?: boolean };

export function DataTable({ columns, children, className = "", ariaLabel }: { columns: Column[]; children: ReactNode; className?: string; ariaLabel?: string }) {
  const template = columns.map((c) => c.width ?? "minmax(0, 1fr)").join(" ");
  return (
    <div className={`table ${className}`.trim()} role="table" aria-label={ariaLabel} style={{ "--table-columns": template } as React.CSSProperties}>
      <div className="table-head" role="row">
        {columns.map((c) => <span key={c.key} role="columnheader" className={`${c.align === "right" ? "is-right" : ""}${c.srOnly ? " visually-hidden" : ""}`.trim()}>{c.label}</span>)}
      </div>
      {children}
    </div>
  );
}

export function TableRow({ onClick, ariaLabel, className = "", children }: { onClick?: () => void; ariaLabel?: string; className?: string; children: ReactNode }) {
  if (!onClick) return <div className={`table-row ${className}`.trim()} role="row">{children}</div>;
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } };
  return <div className={`table-row is-clickable ${className}`.trim()} role="row" tabIndex={0} onClick={onClick} onKeyDown={onKey} aria-label={ariaLabel}>{children}</div>;
}

export function Cell({ align, className = "", children }: { align?: "left" | "right"; className?: string; children?: ReactNode }) {
  return <span role="cell" className={`cell${align === "right" ? " is-right" : ""} ${className}`.trim()}>{children}</span>;
}
