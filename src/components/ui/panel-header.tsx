"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Title + one subtitle line on the left, controls vertically centred on the right.
 * `info` is methodology detail that does not fit the subtitle; it sits behind an info
 * icon revealed on hover and on keyboard focus.
 */
export function PanelHeader({ title, subtitle, info, controls, as: Tag = "h2" }: { title: ReactNode; subtitle: ReactNode; info?: string; controls?: ReactNode; as?: "h2" | "h3" }) {
  return (
    <header className="panel-head">
      <div className="panel-head-text">
        <Tag className="panel-title">{title}{info && <span className="info-tip" tabIndex={0} role="note" aria-label={info}><Info size={14} aria-hidden="true" /><span className="info-tip-body">{info}</span></span>}</Tag>
        <p className="panel-subtitle">{subtitle}</p>
      </div>
      {controls && <div className="panel-controls">{controls}</div>}
    </header>
  );
}
