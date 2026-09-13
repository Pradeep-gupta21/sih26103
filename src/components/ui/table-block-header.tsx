"use client";

import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

/**
 * Header for a list block. The row count is the title. Below it, a control row: a
 * compact search box and filter pills on the left, sort or view controls on the right.
 * `onExport`, when given, downloads what the list currently shows.
 */
export function TableBlockHeader({ title, subtitle, onExport, exportLabel = "Export", controls, controlsRight }: { title: ReactNode; subtitle: ReactNode; onExport?: () => void; exportLabel?: string; controls?: ReactNode; controlsRight?: ReactNode }) {
  return (
    <header className="table-block-head">
      <div className="table-block-title">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        {onExport && <Button variant="secondary" onClick={onExport}><Download size={14} aria-hidden="true" /> {exportLabel}</Button>}
      </div>
      {(controls || controlsRight) && <div className="control-row"><div className="control-row-left">{controls}</div>{controlsRight && <div className="control-row-right">{controlsRight}</div>}</div>}
    </header>
  );
}
