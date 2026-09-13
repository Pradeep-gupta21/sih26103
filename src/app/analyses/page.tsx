"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, ArrowUpRight, FileSearch, FileText, Loader2, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Home, { type ReportDraft } from "../page";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteAnalysis, getAnalysis, listAnalyses, type SavedAnalysis, type SavedAnalysisSummary } from "@/lib/prediction-api";

/**
 * Saved analyses: the records a user kept from the document analyzer. The list is the
 * backend's summary rows; opening one fetches the full record and renders it through the
 * same report component (Home) with the stored result, so nothing is recomputed.
 */

const RISK_CLASS: Record<string, string> = { LOW: "stable", MODERATE: "moderate", HIGH: "high", CRITICAL: "critical" };

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AnalysesPage() {
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="content-wrap"><div className="prediction-hint">Loading saved analyses…</div></div></main></div>}><AnalysesWorkspace /></Suspense>;
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

  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><TopBar title="SAVED ANALYSES" /><div className="content-wrap">
    <header className="intro"><div><span className="eyebrow"><Archive size={13} /> DOCUMENTS</span><h1>Saved analyses</h1><p>Reports kept from the document analyzer. Each one stores the values that were confirmed and the report they produced; the source PDF is not stored.</p></div><button className="export-button" onClick={() => router.push("/documents")}><FileSearch size={15} /> Analyse a document</button></header>

    {notice && <div className="prediction-hint" role="status"><Archive size={14} /> {notice} <button className="text-button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={13} /></button></div>}
    {error && <div className="prediction-error" role="alert"><AlertTriangle size={15} /> {error} <button onClick={() => void load()}>Retry</button></div>}
    {loading && <div className="prediction-hint" aria-live="polite"><Loader2 size={14} className="spinner" /> Loading saved analyses…</div>}

    {!loading && !error && items.length === 0 && <EmptyState icon={<Archive size={17} />} eyebrow="NOTHING SAVED YET" title="No analyses have been saved." actions={<button className="dark-button" onClick={() => router.push("/documents")}>Open document analyzer <ArrowUpRight size={14} /></button>}><p>Analyses appear here when you upload a project PDF on the document analyzer, confirm its values, and choose <strong>Save analysis</strong> on the report.</p></EmptyState>}

    {!loading && !error && items.length > 0 && <section className="portfolio-list table-panel analyses-list" aria-live="polite"><div className="portfolio-list-header"><strong>{items.length} saved {items.length === 1 ? "analysis" : "analyses"}</strong><span>Newest first</span></div>
      <div className="analyses-head" aria-hidden="true"><span>NAME</span><span>SOURCE DOCUMENT</span><span>SAVED</span><span>RISK</span><span>EDITED FIELDS</span><span /></div>
      {items.map((item) => <div className="analyses-row" key={item.id}>
        <button className="analyses-open" onClick={() => void open(item)} disabled={openingId === item.id} aria-label={`Open ${item.name}`}>
          <span><strong>{item.name}</strong><small>{item.id}</small></span>
          <span className="analyses-doc"><FileText size={14} /> {item.document_filename}</span>
          <span><small>SAVED</small><b>{formatSavedAt(item.saved_at)}</b></span>
          <span className="analyses-risk"><strong>{item.risk_percentage}<small>/100</small></strong><StatusChip tone={RISK_CLASS[item.risk_level] ?? "stable"}>{item.risk_level}</StatusChip></span>
          <span><small>EDITED FIELDS</small><b>{item.edited_field_count === 0 ? "None" : item.edited_field_count}</b></span>
          {openingId === item.id ? <Loader2 size={17} className="spinner" /> : <ArrowUpRight size={17} />}
        </button>
        <button className="analyses-delete" onClick={() => setPendingDelete(item)} disabled={deletingId === item.id} aria-label={`Delete ${item.name}`} title="Delete"><Trash2 size={14} /></button>
      </div>)}
    </section>}

    {pendingDelete && <div className="state-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title"><button className="state-close" onClick={() => setPendingDelete(null)} aria-label="Cancel deletion"><X size={16} /></button><span className="eyebrow">DELETE SAVED ANALYSIS</span><h3 id="delete-title">{pendingDelete.name}</h3><p>This removes the saved values and report for {pendingDelete.document_filename}. It cannot be undone.</p><div className="state-page-actions"><button className="dark-button danger" onClick={() => void confirmDelete()} disabled={deletingId === pendingDelete.id}>{deletingId === pendingDelete.id ? <><Loader2 size={14} className="spinner" /> Deleting…</> : <><Trash2 size={14} /> Delete analysis</>}</button><button className="export-button" onClick={() => setPendingDelete(null)}>Keep it</button></div></div>}

    <footer><span><span className="green-dot" /> AI monitoring active</span><span>Saved records are separate from the project registry</span><span>PAIMANA Intelligence v2.4</span></footer>
  </div></main></div>;
}
