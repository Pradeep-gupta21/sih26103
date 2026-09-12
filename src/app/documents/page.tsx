"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, FileSearch, FileText, Loader2, RotateCcw } from "lucide-react";
import Home, { Sidebar, type ReportDraft } from "../page";
import DocumentDropzone, { validateDocumentFile } from "@/components/documents/DocumentDropzone";
import { extractDocumentFields, type DocumentExtractionResponse, type ExtractedField, type ProjectRiskInput } from "@/lib/prediction-api";

/**
 * Document analyzer: upload a project PDF -> the backend reads the ProjectRiskInput fields
 * out of it -> the user reviews and corrects every value -> the reviewed values go through
 * the existing intelligence pipeline and render in the existing report (Home in draft mode).
 *
 * The field list itself comes from the backend response, so this page never invents a field
 * name; the table below only adds review-screen metadata (grouping, units, valid ranges that
 * mirror backend/app/schemas/project.py).
 */

type Step = "upload" | "extracting" | "review" | "confirmed";
const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "extracting", label: "Extracting" },
  { id: "review", label: "Review" },
  { id: "confirmed", label: "Report" },
];

type FieldMeta = { group: string; unit?: string; min?: number; max?: number; exclusiveMin?: boolean; help?: string };
const FIELD_META: Record<keyof ProjectRiskInput, FieldMeta> = {
  sector: { group: "Identity", help: "As named in the project registry, e.g. Railways, Roads, Power" },
  state: { group: "Identity", help: "Indian state or union territory" },
  original_cost: { group: "Cost", unit: "Rs crore", min: 0, exclusiveMin: true, max: 1_000_000_000 },
  revised_cost: { group: "Cost", unit: "Rs crore", min: 0, exclusiveMin: true, max: 1_000_000_000 },
  planned_duration_months: { group: "Schedule", unit: "months", min: 1, max: 240 },
  project_age_months: { group: "Schedule", unit: "months", min: 0, max: 240 },
  previous_schedule_deviation: { group: "Schedule", unit: "%", min: -100, max: 240, help: "Deviation from the original baseline; negative when ahead" },
  physical_progress: { group: "Progress", unit: "%", min: 0, max: 100 },
  financial_progress: { group: "Progress", unit: "%", min: 0, max: 100 },
  milestones_total: { group: "Milestones", min: 1, max: 500 },
  milestones_delayed: { group: "Milestones", min: 0, max: 500 },
  land_acquisition_pending: { group: "Issue flags" },
  clearance_pending: { group: "Issue flags" },
  funding_issue: { group: "Issue flags" },
  contractor_issue: { group: "Issue flags" },
};
const GROUP_ORDER = ["Identity", "Cost", "Schedule", "Progress", "Milestones", "Issue flags", "Other", "Location"];
const COORDINATE_META: Record<string, FieldMeta> = {
  latitude: { group: "Location", unit: "° N", min: -90, max: 90 },
  longitude: { group: "Location", unit: "° E", min: -180, max: 180 },
};

type FormValues = Record<string, string>;

function metaFor(field: ExtractedField): FieldMeta {
  return (FIELD_META as Record<string, FieldMeta>)[field.field] ?? COORDINATE_META[field.field] ?? { group: "Other" };
}

/** Extracted values become editable strings; null stays empty so "not found" is visible, never defaulted. */
function initialValues(fields: ExtractedField[]): FormValues {
  return Object.fromEntries(fields.map((field) => [field.field, field.value === null ? "" : String(field.value)]));
}

function validateField(field: ExtractedField, raw: string, required: boolean): string | null {
  const meta = metaFor(field);
  const value = raw.trim();
  if (value === "") return required ? "Required" : null;
  if (field.value_type === "text") return null;
  if (field.value_type === "boolean") return value === "true" || value === "false" ? null : "Choose yes or no";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Enter a number";
  if (field.value_type === "integer" && !Number.isInteger(number)) return "Must be a whole number";
  if (meta.min !== undefined && (meta.exclusiveMin ? number <= meta.min : number < meta.min)) return meta.exclusiveMin ? `Must be greater than ${meta.min}` : `Minimum ${meta.min}`;
  if (meta.max !== undefined && number > meta.max) return `Maximum ${meta.max}`;
  return null;
}

function coerce(field: ExtractedField, raw: string): string | number | boolean {
  if (field.value_type === "text") return raw.trim();
  if (field.value_type === "boolean") return raw === "true";
  return Number(raw);
}

export default function DocumentsPage() {
  const [active, setActive] = useState("Document analyzer");
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtractionResponse | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const handleFiles = async (files: File[]) => {
    const selected = files[0];
    if (!selected) return;
    const problem = validateDocumentFile(selected, [".pdf"]);
    if (problem) { setFileError(problem); return; }
    setFileError(null);
    setFile(selected);
    setStep("extracting");
    try {
      const result = await extractDocumentFields(selected);
      setExtraction(result);
      setValues(initialValues([...result.fields, ...result.optional_fields]));
      setStep("review");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Document extraction failed");
      setStep("upload");
    }
  };

  const reset = () => { setStep("upload"); setFile(null); setExtraction(null); setValues({}); setDraft(null); setFileError(null); };

  const errors = useMemo(() => {
    if (!extraction) return {} as Record<string, string>;
    const result: Record<string, string> = {};
    for (const field of extraction.fields) {
      const problem = validateField(field, values[field.field] ?? "", true);
      if (problem) result[field.field] = problem;
    }
    const total = Number(values.milestones_total), delayed = Number(values.milestones_delayed);
    if (!result.milestones_total && !result.milestones_delayed && Number.isFinite(total) && Number.isFinite(delayed) && delayed > total) result.milestones_delayed = "Cannot exceed total milestones";
    for (const field of extraction.optional_fields) {
      const problem = validateField(field, values[field.field] ?? "", false);
      if (problem) result[field.field] = problem;
    }
    const hasLat = (values.latitude ?? "").trim() !== "", hasLon = (values.longitude ?? "").trim() !== "";
    if (hasLat !== hasLon) result[hasLat ? "longitude" : "latitude"] = "Supply both coordinates, or neither";
    return result;
  }, [extraction, values]);

  const stats = useMemo(() => {
    const fields = extraction?.fields ?? [];
    return {
      found: fields.filter((field) => field.value !== null).length,
      low: fields.filter((field) => field.confidence === "low").length,
      missing: fields.filter((field) => field.value === null).length,
      total: fields.length,
    };
  }, [extraction]);

  const confirm = () => {
    if (!extraction || !file || Object.keys(errors).length > 0) return;
    const input = Object.fromEntries(extraction.fields.map((field) => [field.field, coerce(field, values[field.field] ?? "")])) as unknown as ProjectRiskInput;
    const hasLocation = (values.latitude ?? "").trim() !== "" && (values.longitude ?? "").trim() !== "";
    setDraft({
      label: file.name.replace(/\.pdf$/i, ""),
      source: file.name,
      input,
      latitude: hasLocation ? Number(values.latitude) : null,
      longitude: hasLocation ? Number(values.longitude) : null,
    });
    setStep("confirmed");
  };

  if (step === "confirmed" && draft) return <Home draft={draft} onEditDraft={() => setStep("review")} />;

  const groups = extraction ? GROUP_ORDER.map((group) => ({ group, fields: [...extraction.fields, ...extraction.optional_fields].filter((field) => metaFor(field).group === group) })).filter((entry) => entry.fields.length > 0) : [];
  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><header className="topbar"><div className="breadcrumb"><strong>DOCUMENT ANALYZER</strong></div></header><div className="content-wrap">
    <header className="intro"><div><span className="eyebrow"><FileSearch size={13} /> DOCUMENTS</span><h1>Document analyzer</h1><p>Upload a project PDF, review the values it states, then run the same risk, explanation, similarity and GIS pipeline used for registry projects.</p></div>{file && <button className="export-button" onClick={reset}><RotateCcw size={15} /> Start over</button>}</header>
    <ol className="analyzer-steps" aria-label="Analyzer progress">{STEPS.map((item, index) => <li key={item.id} className={index === stepIndex ? "current" : index < stepIndex ? "done" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</li>)}</ol>

    {step === "upload" && <section className="analyzer-panel"><DocumentDropzone accept={[".pdf"]} multiple={false} onFiles={handleFiles} prompt="Drag & drop a project PDF here" />{fileError && <div className="prediction-error" role="alert"><AlertTriangle size={15} /> {fileError}</div>}<p className="analyzer-note">Only the PDF&apos;s text layer is read. Scanned documents without a text layer will return no values. Nothing is stored: the file is read once for extraction and the values are shown here for you to confirm.</p></section>}

    {step === "extracting" && <div className="prediction-hint" aria-live="polite"><Loader2 size={14} className="spinner" /> Reading {file?.name}…</div>}

    {step === "review" && extraction && <>
      <section className="analyzer-summary" aria-label="Extraction summary"><div><span>DOCUMENT</span><strong><FileText size={14} /> {extraction.filename}</strong><small>{extraction.page_count} {extraction.page_count === 1 ? "page" : "pages"} · {extraction.text_characters.toLocaleString()} characters of text</small></div><div><span>FOUND</span><strong>{stats.found} <small>/ {stats.total}</small></strong></div><div className={stats.low ? "warn" : ""}><span>LOW CONFIDENCE</span><strong>{stats.low}</strong></div><div className={stats.missing ? "warn" : ""}><span>NOT FOUND</span><strong>{stats.missing}</strong></div></section>
      {extraction.warnings.map((warning) => <div className="prediction-hint" key={warning}><AlertTriangle size={14} /> {warning}</div>)}
      <p className="analyzer-note">Check every value against its source line. Low-confidence and missing fields are flagged; edit anything that is wrong. The report runs only on what you confirm here.</p>

      <form className="analyzer-form" onSubmit={(event) => { event.preventDefault(); confirm(); }}>
        {groups.map(({ group, fields }) => <fieldset className="analyzer-group" key={group}><legend className="eyebrow">{group.toUpperCase()}{group === "Location" && <small> · optional, enables GIS screening</small>}</legend>
          {fields.map((field) => {
            const meta = metaFor(field);
            const raw = values[field.field] ?? "";
            const edited = raw !== (field.value === null ? "" : String(field.value));
            const optional = field.field in COORDINATE_META;
            const status = edited ? "edited" : field.value === null ? (optional ? "optional" : "missing") : field.confidence === "low" ? "low" : "high";
            const error = errors[field.field];
            const id = `field-${field.field}`;
            return <div className={`analyzer-field conf-${status}${error ? " invalid" : ""}`} key={field.field}>
              <label htmlFor={id}><span>{field.label}</span>{meta.unit && <small>{meta.unit}</small>}</label>
              <div className="analyzer-input">
                {field.value_type === "boolean" ? <select id={id} value={raw} onChange={(event) => setValues((previous) => ({ ...previous, [field.field]: event.target.value }))}><option value="">Not stated</option><option value="true">Yes</option><option value="false">No</option></select>
                  : <input id={id} type={field.value_type === "text" ? "text" : "number"} step={field.value_type === "integer" ? 1 : "any"} value={raw} placeholder={field.value === null ? (optional ? "Optional" : "Not found — enter manually") : ""} onChange={(event) => setValues((previous) => ({ ...previous, [field.field]: event.target.value }))} aria-invalid={Boolean(error)} />}
                <span className={`field-badge conf-${status}`}>{status === "edited" ? "Edited" : status === "missing" ? "Not found" : status === "optional" ? "Not stated" : status === "low" ? "Low confidence" : "High confidence"}</span>
              </div>
              <div className="field-source">{field.source_snippet ? <q title={field.source_snippet}>{field.page ? `p.${field.page} · ` : ""}{field.source_snippet}</q> : <small>No matching line in the document{meta.help ? ` · ${meta.help}` : ""}</small>}{field.note && !(optional && field.value === null) && <em>{field.note}</em>}{error && <b role="alert">{error}</b>}</div>
            </div>;
          })}
        </fieldset>)}

        {extraction.unmatched_text.length > 0 && <section className="analyzer-unmatched"><button type="button" className="text-button" onClick={() => setShowUnmatched(!showUnmatched)} aria-expanded={showUnmatched}>{showUnmatched ? "Hide" : "Show"} {extraction.unmatched_text.length} numeric lines not mapped to any field</button>{showUnmatched && <ul>{extraction.unmatched_text.map((line) => <li key={line}>{line}</li>)}</ul>}</section>}

        <div className="analyzer-actions"><button type="submit" className="dark-button" disabled={Object.keys(errors).length > 0}><Check size={14} /> Confirm values and run analysis <ArrowUpRight size={14} /></button><span>{Object.keys(errors).length > 0 ? `${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? "" : "s"} still need${Object.keys(errors).length === 1 ? "s" : ""} a valid value` : "All required fields have a value"}</span></div>
      </form>
    </>}
    <footer><span><span className="green-dot" /> AI monitoring active</span><span>Values are read from the uploaded document only</span><span>PAIMANA Intelligence v2.4</span></footer>
  </div></main></div>;
}
