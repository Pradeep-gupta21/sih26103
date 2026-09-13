"use client";

import { ArrowUpRight, FileSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RecentAnalysis } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { StatusChip } from "@/components/ui/status-chip";

const RISK_CLASS: Record<string, string> = { LOW: "stable", MODERATE: "moderate", HIGH: "high", CRITICAL: "critical" };

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Newest saved document analyses. An empty store renders an empty state, never placeholder rows. */
export function RecentAnalyses({ rows, error }: { rows: RecentAnalysis[]; error: string | null }) {
  const router = useRouter();
  const summary = rows.length === 0 ? "No saved document analyses yet." : `Recent document analyses: ` + rows.map((r) => `${r.project_name}, saved ${formatSavedAt(r.created_at)}, risk ${r.risk_band_or_score} ${r.risk_percentage} out of 100`).join("; ") + ".";
  return (
    <Panel eyebrow="DOCUMENTS" title="Recent document analyses" summary={summary} className="overview-panel-full overview-panel-table" aside={<button className="text-button" onClick={() => router.push("/analyses")}>All saved analyses <ArrowUpRight size={13} /></button>}>
      {error && <div className="prediction-error" role="alert">{error}</div>}
      {!error && rows.length === 0 && <div className="overview-empty"><FileSearch size={16} aria-hidden="true" /><span>No saved analyses yet.</span><button className="text-button" onClick={() => router.push("/documents")}>Analyse a document <ArrowUpRight size={13} /></button></div>}
      {rows.length > 0 && <div className="overview-analyses-head" aria-hidden="true"><span>PROJECT</span><span>SAVED</span><span>RISK BAND</span><span /></div>}
      {rows.map((row) => (
        <button className="overview-analysis-row" key={row.analysis_id} onClick={() => router.push(`/analyses?open=${encodeURIComponent(row.analysis_id)}`)} aria-label={`Open saved analysis ${row.project_name}`}>
          <strong>{row.project_name}</strong>
          <span>{formatSavedAt(row.created_at)}</span>
          <span><StatusChip tone={RISK_CLASS[row.risk_band_or_score] ?? "watch"}>{row.risk_band_or_score}</StatusChip> <small>{row.risk_percentage}/100</small></span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      ))}
    </Panel>
  );
}
