"use client";

import type { ReactNode } from "react";
import { Card } from "./card";
import { PanelHeader } from "./panel-header";

/**
 * Card + PanelHeader + body, the unit every dashboard block is built from.
 * `summary` is read by screen readers in place of the chart it describes.
 */
export function Panel({ title, subtitle, info, controls, footer, summary, className = "", bodyClassName = "", children }: { title: string; subtitle: ReactNode; info?: string; controls?: ReactNode; footer?: ReactNode; summary: string; className?: string; bodyClassName?: string; children: ReactNode }) {
  return (
    <Card className={`panel ${className}`.trim()} aria-label={title}>
      <PanelHeader title={title} subtitle={subtitle} info={info} controls={controls} />
      <p className="visually-hidden">{summary}</p>
      <div className={`panel-body ${bodyClassName}`.trim()}>{children}</div>
      {footer && <footer className="panel-footer">{footer}</footer>}
    </Card>
  );
}
