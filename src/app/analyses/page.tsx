"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, ArrowUpRight, FileSearch, FileText, Loader2, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Home, { type ReportDraft } from "../page";
import { deleteAnalysis, getAnalysis, listAnalyses, type SavedAnalysis, type SavedAnalysisSummary } from "@/lib/prediction-api";
import { AppShell, PageFooter } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cell, DataTable, TableRow } from "@/components/ui/data-table";
import { TableBlockHeader } from "@/components/ui/table-block-header";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { formatIndian } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

/**
 * Saved analyses: the records a user kept from the document analyzer. The list is the
 * backend's summary rows; opening one fetches the full record and renders it through the
 * same report component (Home) with the stored result, so nothing is recomputed.
 */

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AnalysesPage() {
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="page"><div className="notice">Loading saved analyses…</div></div></main></div>}><AnalysesWorkspace /></Suspense>;
}

function AnalysesWorkspace() {
  const router = useRouter();
  // ?open=<id> lands directly on one saved report (used by the dashboard's recent-analyses rows).
  const requestedId = useSearchParams().get("open");
  const [active, setActive] = useState("Saved analyses");
  const [items, setItems] = useState<SavedAnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<SavedAnalysis | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedAnalysisSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await listAnalyses());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load saved analyses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    listAnalyses()
      .then((records) => { if (!cancelled) setItems(records); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load saved analyses"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const open = async (summary: SavedAnalysisSummary) => {
    setOpeningId(summary.id);
    setError(null);
    try {
      setOpened(await getAnalysis(summary.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open the saved analysis");
    } finally {
      setOpeningId(null);
    }
  };

  useEffect(() => {
    if (!requestedId) return;
    let cancelled = false;
    getAnalysis(requestedId)
      .then((record) => { if (!cancelled) setOpened(record); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to open the saved analysis"); });
    return () => { cancelled = true; };
  }, [requestedId]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      await deleteAnalysis(pendingDelete.id);
      setNotice(`"${pendingDelete.name}" was deleted.`);
      setPendingDelete(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete the analysis");
    } finally {
      setDeletingId(null);
    }
  };

  // The saved record becomes a report draft; Home renders the stored result without re-running the pipeline.
  const openedDraft = useMemo<ReportDraft | null>(() => opened ? {
    label: opened.name,
    source: opened.document.filename,
    input: opened.confirmed_values,
    latitude: opened.latitude ?? null,
    longitude: opened.longitude ?? null,
    savedAt: opened.saved_at,
  } : null, [opened]);

  if (opened && openedDraft) return <Home draft={openedDraft} precomputed={opened.result} onBack={{ label: "Saved analyses", onClick: () => { setOpened(null); if (requestedId) router.replace("/analyses"); } }} />;

  const exportCsv = () => downloadCsv("saved-analyses.csv", ["id", "name", "document", "saved_at", "risk_percentage", "risk_level", "edited_fields"], items.map((item) => [item.id, item.name, item.document_filename, item.saved_at, item.risk_percentage, item.risk_level, item.edited_field_count]));

  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="Documents" title="Saved analyses" subtitle="Reports kept from the document analyzer, with the values that were confirmed. The source PDF is not stored."
        controls={<Button variant="primary" onClick={() => router.push("/documents")}><FileSearch size={15} aria-hidden="true" /> Analyse a document</Button>} />

      {notice && <div className="notice" role="status"><Archive size={14} aria-hidden="true" /> {notice} <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setNotice(null)} aria-label="Dismiss"><X size={13} /></button></div>}
      {error && <div className="notice notice-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error} <button onClick={() => void load()}>Retry</button></div>}
      {loading && <PanelSkeleton height={240} />}

      {!loading && !error && items.length === 0 && <Card><EmptyState icon={<Archive size={20} />} title="No analyses have been saved" hint="Upload a project PDF on the document analyzer, confirm its values, and choose Save analysis on the report." action={<Button variant="primary" onClick={() => router.push("/documents")}>Open document analyzer <ArrowUpRight size={14} aria-hidden="true" /></Button>} /></Card>}

      {!loading && !error && items.length > 0 && <Card aria-live="polite">
        <TableBlockHeader title={`${formatIndian(items.length)} saved ${items.length === 1 ? "analysis" : "analyses"}`} subtitle="Newest first" onExport={exportCsv} />
        <DataTable ariaLabel="Saved analyses" columns={[{ key: "name", label: "Name", width: "minmax(0, 1.6fr)" }, { key: "doc", label: "Source document", width: "minmax(0, 1.4fr)" }, { key: "saved", label: "Saved", width: "minmax(0, 1fr)" }, { key: "risk", label: "Risk", width: "150px" }, { key: "edited", label: "Edited fields", width: "110px", align: "right" }, { key: "actions", label: "Actions", srOnly: true, width: "72px" }]}>
          {items.map((item) => (
            <TableRow key={item.id} onClick={() => void open(item)} ariaLabel={`Open ${item.name}`}>
              <Cell><strong title={item.name}>{item.name}</strong><small>{item.id}</small></Cell>
              <Cell className="cell-truncate"><span title={item.document_filename}><FileText size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />{item.document_filename}</span></Cell>
              <Cell>{formatSavedAt(item.saved_at)}</Cell>
              <Cell><StatusChip tone={item.risk_level}>{item.risk_level}</StatusChip> <small style={{ display: "inline", marginLeft: 6 }}>{item.risk_percentage}/100</small></Cell>
              <Cell align="right">{item.edited_field_count === 0 ? "None" : item.edited_field_count}</Cell>
              <Cell className="analyses-row-actions">{openingId === item.id ? <Loader2 size={16} className="spinner" aria-hidden="true" /> : <ArrowUpRight size={16} className="row-arrow" aria-hidden="true" />}<button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={(event) => { event.stopPropagation(); setPendingDelete(item); }} disabled={deletingId === item.id} aria-label={`Delete ${item.name}`} title="Delete"><Trash2 size={14} /></button></Cell>
            </TableRow>
          ))}
        </DataTable>
      </Card>}

      {pendingDelete && <div className="state-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title"><button className="state-close" onClick={() => setPendingDelete(null)} aria-label="Cancel deletion"><X size={16} /></button><span className="eyebrow">Delete saved analysis</span><h3 id="delete-title">{pendingDelete.name}</h3><p>This removes the saved values and report for {pendingDelete.document_filename}. It cannot be undone.</p><div className="state-actions"><Button variant="primary" className="btn-danger" onClick={() => void confirmDelete()} disabled={deletingId === pendingDelete.id}>{deletingId === pendingDelete.id ? <><Loader2 size={14} className="spinner" aria-hidden="true" /> Deleting…</> : <><Trash2 size={14} aria-hidden="true" /> Delete analysis</>}</Button><Button variant="secondary" onClick={() => setPendingDelete(null)}>Keep it</Button></div></div>}

      <PageFooter>Saved records are separate from the project registry</PageFooter>
    </AppShell>
  );
}
