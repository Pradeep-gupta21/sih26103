"use client";

import { ArrowUpRight, FileSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RecentAnalysis } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { Cell, DataTable, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Newest saved document analyses. The least prominent block on the page; an empty store renders an empty state, never placeholder rows. */
export function RecentAnalyses({ rows, error }: { rows: RecentAnalysis[]; error: string | null }) {
  const router = useRouter();
  const summary = rows.length === 0 ? "No saved document analyses yet." : `Recent document analyses: ` + rows.map((r) => `${r.project_name}, saved ${formatSavedAt(r.created_at)}, risk ${r.risk_band_or_score} ${r.risk_percentage} out of 100`).join("; ") + ".";
  return (
    <Panel title="Recent document analyses" subtitle="The five most recently saved reports from the document analyzer." summary={summary} className="span-12 card-quiet"
      controls={<button type="button" className="link" onClick={() => router.push("/analyses")}>All saved analyses <ArrowUpRight size={14} aria-hidden="true" /></button>}>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {!error && rows.length === 0 && <EmptyState compact icon={<FileSearch size={20} />} title="No saved analyses yet" hint="Reports you save from the document analyzer appear here." action={<button type="button" className="link" onClick={() => router.push("/documents")}>Analyse a document <ArrowUpRight size={14} aria-hidden="true" /></button>} />}
      {rows.length > 0 && (
        <DataTable ariaLabel="Recent analyses" columns={[{ key: "name", label: "Project", width: "minmax(0, 2fr)" }, { key: "saved", label: "Saved", width: "minmax(0, 1fr)" }, { key: "risk", label: "Risk band", width: "minmax(0, 1fr)" }, { key: "open", label: "Open", srOnly: true, width: "16px" }]}>
          {rows.map((row) => (
            <TableRow key={row.analysis_id} onClick={() => router.push(`/analyses?open=${encodeURIComponent(row.analysis_id)}`)} ariaLabel={`Open saved analysis ${row.project_name}`}>
              <Cell><strong>{row.project_name}</strong></Cell>
              <Cell>{formatSavedAt(row.created_at)}</Cell>
              <Cell><StatusChip tone={row.risk_band_or_score}>{row.risk_band_or_score}</StatusChip> <small style={{ display: "inline", marginLeft: 6 }}>{row.risk_percentage}/100</small></Cell>
              <Cell><ArrowUpRight size={16} className="row-arrow" aria-hidden="true" /></Cell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
