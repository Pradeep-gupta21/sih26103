import type { BoundaryCategory, CollisionType, Severity } from "@/lib/gis-api";

export type ProjectRiskInput = {
  sector: string;
  state: string;
  original_cost: number;
  revised_cost: number;
  planned_duration_months: number;
  project_age_months: number;
  physical_progress: number;
  financial_progress: number;
  milestones_total: number;
  milestones_delayed: number;
  land_acquisition_pending: boolean;
  clearance_pending: boolean;
  funding_issue: boolean;
  contractor_issue: boolean;
  previous_schedule_deviation: number;
};

export type ProjectRecord = ProjectRiskInput & {
  project_id: string;
};

export type ProjectListFilters = {
  search?: string;
  sector?: string;
  state?: string;
};

export type RiskFactor = {
  factor: string;
  impact: "increases_risk" | "reduces_risk";
  importance: number;
  description: string;
};

export type ProjectRiskResponse = {
  project_risk: {
    delay_probability: number;
    risk_percentage: number;
    risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    model_confidence: "LOW" | "MEDIUM" | "HIGH";
    confidence_basis: string;
  };
  top_risk_factors: RiskFactor[];
  summary: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function predictProjectRisk(input: ProjectRiskInput): Promise<ProjectRiskResponse> {
  const response = await fetch(`${API_URL}/api/v1/predict-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail?.[0]?.msg ?? error?.detail ?? `Prediction failed (${response.status})`);
  }
  return response.json() as Promise<ProjectRiskResponse>;
}

// --- Historical project similarity ---

// Mirrors backend/app/schemas/similarity.py (HistoricalProjectMatch / HistoricalEvidence / SimilarityResponse).
export type HistoricalProjectMatch = {
  project_id: string;
  project_name: string;
  sector: string;
  state: string;
  similarity_score: number;
  actual_delay_months: number;
  actual_cost_overrun_percentage: number;
  final_status: string;
  primary_delay_cause: string;
  intervention_taken: string;
  intervention_outcome: string;
};

export type HistoricalEvidence = {
  projects_analyzed: number;
  average_similarity: number;
  average_actual_delay_months: number;
  average_cost_overrun_percentage: number;
  projects_with_significant_delay: number;
  significant_delay_percentage: number;
  most_common_delay_cause: string;
};

export type SimilarityResponse = {
  similar_projects: HistoricalProjectMatch[];
  historical_evidence: HistoricalEvidence;
  historical_summary: string;
};

export type ProjectIntelligenceResponse = {
  project_risk: ProjectRiskResponse["project_risk"];
  top_risk_factors: RiskFactor[];
  risk_summary: string;
  similar_projects: Array<{
    project_id: string;
    similarity_score: number;
    sector: string;
    state: string;
    actual_delay_months: number;
    actual_cost_overrun_percentage: number;
    primary_delay_cause: string;
  }>;
  historical_evidence: {
    projects_analyzed: number;
    significant_delay_percentage: number;
    average_actual_delay_months: number;
    most_common_delay_cause: string;
  };
  historical_summary: string;
  /** Present only when latitude/longitude were supplied to the pipeline. */
  gis_screening?: GisScreening | null;
  priority?: PriorityResult | null;
  interventions?: InterventionRecommendation[];
};

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const error = await response.json().catch(() => null);
  return new Error(error?.detail?.[0]?.msg ?? error?.detail ?? `${fallback} (${response.status})`);
}

export async function getProject(projectId: string): Promise<ProjectRecord> {
  const response = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}`);
  if (!response.ok) {
    throw await readApiError(response, "Project lookup failed");
  }
  return response.json() as Promise<ProjectRecord>;
}

export async function getProjects(filters: ProjectListFilters = {}): Promise<ProjectRecord[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.sector) params.set("sector", filters.sector);
  if (filters.state) params.set("state", filters.state);
  const query = params.toString();
  const response = await fetch(`${API_URL}/api/v1/projects${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw await readApiError(response, "Project list failed");
  }
  return response.json() as Promise<ProjectRecord[]>;
}

export async function getProjectIntelligence(
  projectId: string,
  input: ProjectRiskInput,
): Promise<ProjectIntelligenceResponse> {
  const response = await fetch(`${API_URL}/api/v1/project-intelligence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, project_id: projectId }),
  });
  if (!response.ok) {
    throw await readApiError(response, "Project intelligence failed");
  }
  return response.json() as Promise<ProjectIntelligenceResponse>;
}

export async function findSimilarProjects(input: ProjectRiskInput): Promise<SimilarityResponse> {
  const response = await fetch(`${API_URL}/api/v1/similar-projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail?.[0]?.msg ?? error?.detail ?? `Similarity search failed (${response.status})`);
  }
  return response.json() as Promise<SimilarityResponse>;
}

// --- Full intelligence pipeline (risk -> SHAP -> similarity -> GIS -> priority -> interventions) ---

/**
 * The GIS screening section of the intelligence response.
 *
 * Structured evidence only -- no geometry. The map at /gis-check is where geometry
 * lives; this section carries the verdict the priority engine actually scored.
 */
export type GisScreening = {
  gis_status: CollisionType;
  gis_severity: Severity | null;
  buffer_meters: number;
  collision_count: number;
  boundaries_checked: number;
  highest_risk_category: BoundaryCategory | null;
  highest_risk_category_label: string | null;
  nearest_boundary: {
    boundary_id: string;
    name: string;
    category: BoundaryCategory;
    category_label: string;
    distance_meters: number;
    collision_type: CollisionType;
    severity: Severity;
  } | null;
  clearance_required: boolean;
  clearance_flag_count: number;
  clearance_flags: string[];
  max_buffer_overlap_percentage: number;
  total_intersection_area_sqm: number;
  /** Approved screening wording. Never a permitting determination. */
  advisory: string;
  /** Competent-authority verification notice; always displayed alongside a conflict. */
  disclaimer: string;
  contains_demo_data: boolean;
  notice: string | null;
};

export type PriorityComponent = {
  name: string;
  score: number;
  weight: number;
  weighted_contribution: number;
  description: string;
};

export type PriorityResult = {
  priority_score: number;
  weight_profile: "standard" | "with_gis";
  priority_category: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommended_attention_level: string;
  decision_explanation: string;
  score_breakdown: PriorityComponent[];
};

export type InterventionRecommendation = {
  rank: number;
  id: string;
  title: string;
  category: string;
  urgency: string;
  rationale: string;
  expected_impact: string;
  evidence_source: string;
};

/**
 * Run the whole pipeline in one call.
 *
 * `latitude`/`longitude` are optional: supplying them adds the GIS screening stage and
 * switches the priority engine to its GIS weight profile. Omitting them returns the
 * pipeline exactly as it behaved before the GIS module existed.
 */
export async function fetchProjectIntelligence(
  input: ProjectRiskInput & { latitude?: number | null; longitude?: number | null; buffer_meters?: number },
): Promise<ProjectIntelligenceResponse> {
  const response = await fetch(`${API_URL}/api/v1/project-intelligence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail?.[0]?.msg ?? error?.detail ?? `Intelligence request failed (${response.status})`);
  }
  return response.json() as Promise<ProjectIntelligenceResponse>;
}

export type GISBufferInput = { project_id?: string; latitude: number; longitude: number; buffer_distance_km: number; zone_categories?: string[] };
export type ZoneCollision = { zone_id: string; zone_name: string; zone_category: string; state: string; designation: string; clearance_type_required: string; distance_to_boundary_km: number; is_direct_intersection: boolean; intersection_area_sq_km: number; severity: "CRITICAL" | "HIGH" | "WARNING" };
export type GISFeatureProperties = { name?: string; category?: string; state?: string; collision_severity?: string; clearance_type_required?: string; [key: string]: unknown };
export type GISGeoJSON = import("geojson").FeatureCollection<import("geojson").Geometry, GISFeatureProperties>;
export type GISCollisionResponse = { has_collision: boolean; total_collisions: number; highest_severity: "NONE" | "WARNING" | "HIGH" | "CRITICAL"; clearance_required: boolean; buffer_distance_km: number; project_coordinates: { latitude: number; longitude: number }; collisions: ZoneCollision[]; geojson_layers: GISGeoJSON; summary: string };

export async function checkGisCollision(input: GISBufferInput): Promise<GISCollisionResponse> {
  const response = await fetch(`${API_URL}/api/v1/gis/check-collision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`GIS collision check failed (${response.status})`);
  return response.json() as Promise<GISCollisionResponse>;
}

export type DocumentCategory = "Detailed Project Report (DPR)" | "Environmental Clearance" | "Land Acquisition Record" | "Financial & Expenditure Report" | "Site Survey & Geotechnical" | "Contract & Tender Agreement" | "Other / Supporting Document";
export type DocumentMetadata = { document_id: string; project_id: string; filename: string; file_type: string; file_size: number; uploaded_at: string; uploaded_by: string; status: string; stored_filename: string; category: DocumentCategory | null; description: string | null };
export type DocumentUploadResponse = { document_id: string; project_id: string; filename: string; file_type: string; file_size: number; uploaded_at: string; uploaded_by: string; status: string; message: string };
export type DocumentListResponse = { project_id: string; total_count: number; total_size_bytes: number; documents: DocumentMetadata[] };

export async function fetchProjectDocuments(projectId: string): Promise<DocumentListResponse> {
  const response = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents`);
  if (!response.ok) throw new Error(`Failed to fetch documents (${response.status})`);
  return response.json() as Promise<DocumentListResponse>;
}
export async function uploadProjectDocument(projectId: string, file: File, category: DocumentCategory = "Other / Supporting Document", description?: string, uploader = "Ananya Sharma"): Promise<DocumentUploadResponse> {
  const formData = new FormData(); formData.append("file", file); formData.append("category", category); if (description) formData.append("description", description); formData.append("uploader", uploader);
  const response = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents`, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`Document upload failed (${response.status})`);
  return response.json() as Promise<DocumentUploadResponse>;
}
export async function deleteProjectDocument(projectId: string, documentId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Failed to delete document (${response.status})`);
  return response.json();
}
export async function updateProjectDocument(projectId: string, documentId: string, update: { category?: DocumentCategory; description?: string }): Promise<DocumentMetadata> {
  const response = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
  if (!response.ok) throw new Error(`Failed to update document (${response.status})`);
  return response.json() as Promise<DocumentMetadata>;
}
export function getDocumentDownloadUrl(projectId: string, documentId: string): string {
  return `${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/download`;
}

// --- Document analyzer (POST /documents/extract) ---

export type ExtractionConfidence = "high" | "low";
export type ExtractedValueType = "text" | "number" | "integer" | "boolean";
/** One prediction input as read from a PDF. `value` is null when the document did not state it. */
export type ExtractedField = {
  field: string;
  label: string;
  value_type: ExtractedValueType;
  value: string | number | boolean | null;
  confidence: ExtractionConfidence | null;
  source_snippet: string | null;
  page: number | null;
  note: string | null;
};
export type DocumentExtractionResponse = {
  filename: string;
  page_count: number;
  text_characters: number;
  /** One entry per ProjectRiskInput field, in model order. */
  fields: ExtractedField[];
  /** latitude / longitude when the document states them; optional to the pipeline. */
  optional_fields: ExtractedField[];
  unmatched_text: string[];
  warnings: string[];
};

export async function extractDocumentFields(file: File): Promise<DocumentExtractionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/v1/documents/extract`, { method: "POST", body: formData });
  if (!response.ok) throw await readApiError(response, "Document extraction failed");
  return response.json() as Promise<DocumentExtractionResponse>;
}

// --- Saved document analyses (/analyses) ---
// Mirrors backend/app/schemas/analysis.py. Kept apart from ProjectRecord on purpose: these are
// document-derived records a user chose to keep, not rows of the project registry.

export type SavedFieldMeta = { confidence: ExtractionConfidence | null; edited: boolean; source_snippet?: string | null; page?: number | null };
export type SavedDocument = { filename: string; page_count: number };
export type SavedAnalysisCreate = {
  name: string;
  document: SavedDocument;
  confirmed_values: ProjectRiskInput;
  latitude?: number | null;
  longitude?: number | null;
  field_metadata: Record<string, SavedFieldMeta>;
  result: ProjectIntelligenceResponse;
};
export type SavedAnalysis = SavedAnalysisCreate & { id: string; saved_at: string };
export type SavedAnalysisSummary = {
  id: string;
  name: string;
  document_filename: string;
  saved_at: string;
  risk_percentage: number;
  risk_level: string;
  edited_field_count: number;
};

export async function createAnalysis(payload: SavedAnalysisCreate): Promise<SavedAnalysis> {
  const response = await fetch(`${API_URL}/api/v1/analyses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw await readApiError(response, "Saving the analysis failed");
  return response.json() as Promise<SavedAnalysis>;
}
export async function listAnalyses(): Promise<SavedAnalysisSummary[]> {
  const response = await fetch(`${API_URL}/api/v1/analyses`);
  if (!response.ok) throw await readApiError(response, "Loading saved analyses failed");
  return response.json() as Promise<SavedAnalysisSummary[]>;
}
export async function getAnalysis(analysisId: string): Promise<SavedAnalysis> {
  const response = await fetch(`${API_URL}/api/v1/analyses/${encodeURIComponent(analysisId)}`);
  if (!response.ok) throw await readApiError(response, "Loading the saved analysis failed");
  return response.json() as Promise<SavedAnalysis>;
}
export async function deleteAnalysis(analysisId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_URL}/api/v1/analyses/${encodeURIComponent(analysisId)}`, { method: "DELETE" });
  if (!response.ok) throw await readApiError(response, "Deleting the analysis failed");
  return response.json();
}

// --- SLA rule monitoring (/sla/*) — deterministic threshold checks on projects.csv fields ---
// Mirrors backend/app/schemas/sla_rules.py. Separate from the older milestone-deadline SLA below.

export const SLA_RULE_IDS = ["schedule_overrun", "cost_escalation", "progress_shortfall", "reporting_divergence", "milestone_slippage"] as const;
export type SlaRuleId = (typeof SLA_RULE_IDS)[number];
export type SlaRuleSeverity = "CRITICAL" | "WARNING";
export type SlaRuleDefinition = { id: SlaRuleId; name: string; description: string; threshold: number; unit: string; comparison: "greater_than" };
export type SlaRuleResult = { rule_id: SlaRuleId; name: string; measured_value: number; threshold: number; unit: string; breached: boolean; severity: SlaRuleSeverity | null; detail: string };
export type SlaAlertPreview = {
  dispatched: false;
  delivery_enabled: boolean;
  recipient_role: string;
  recipient_configured: boolean;
  rule_id: SlaRuleId;
  rule_name: string;
  project_id: string;
  measured_value: number;
  threshold: number;
  unit: string;
  message: string;
};
export type ProjectSlaReport = {
  project_id: string;
  sector: string;
  state: string;
  evaluated_rules: number;
  breached_rules: number;
  overall_status: "PASS" | "BREACH";
  worst_severity: SlaRuleSeverity | null;
  results: SlaRuleResult[];
  alert_preview: SlaAlertPreview | null;
};
export type SlaBreachRow = { project_id: string; sector: string; state: string; breached_rules: SlaRuleId[]; worst_severity: SlaRuleSeverity; worst_rule: SlaRuleResult; /** The filtered rule's measurement, present only when a rule filter is applied. */ filter_rule: SlaRuleResult | null };
export type SlaBreachListResponse = {
  summary: { projects_evaluated: number; projects_in_breach: number; projects_passing: number; breaches_by_rule: Record<string, number>; delivery_enabled: boolean };
  rules: SlaRuleDefinition[];
  rule_filter: SlaRuleId | null;
  total_matching: number;
  rows: SlaBreachRow[];
  passing_project_ids: string[];
};

export async function getSlaBreaches(options: { rule?: SlaRuleId | null; limit?: number; offset?: number } = {}): Promise<SlaBreachListResponse> {
  const params = new URLSearchParams();
  if (options.rule) params.set("rule", options.rule);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  const query = params.toString();
  const response = await fetch(`${API_URL}/api/v1/sla/breaches${query ? `?${query}` : ""}`);
  if (!response.ok) throw await readApiError(response, "SLA evaluation failed");
  return response.json() as Promise<SlaBreachListResponse>;
}
export async function getProjectSlaReport(projectId: string): Promise<ProjectSlaReport> {
  const response = await fetch(`${API_URL}/api/v1/sla/projects/${encodeURIComponent(projectId)}`);
  if (!response.ok) throw await readApiError(response, "SLA evaluation failed");
  return response.json() as Promise<ProjectSlaReport>;
}

export type SlaStatusResponse = {
  project_id: string;
  milestone: string;
  deadline: string;
  sla_status: string;
  days_remaining: number;
  days_overdue: number;
  severity: string;
  escalation_level: string;
  notification_required: boolean;
  ai_risk_score: number | null;
  notification_status: string;
  notification_recipient?: string | null;
  notification_timestamp?: string | null;
  msg91_request_id?: string | null;
  notification_error?: string | null;
};

export async function getProjectSla(projectId: string): Promise<SlaStatusResponse> {
  const response = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/sla`);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? `SLA status failed (${response.status})`);
  }
  return response.json() as Promise<SlaStatusResponse>;
}

// --- Portfolio overview (/dashboard) ---------------------------------------------------
// One request for every aggregate on the overview; every number is computed by the backend
// from the registry and the same SLA evaluation /sla uses.

export type PortfolioKpis = { projects_tracked: number; risk_signals_active: number; sla_in_breach: number; cost_overrun_total: number; cost_overrun_unit: string; schedule_overrun_median_months: number; schedule_overrun_project_count: number; milestones_delayed_total: number; milestones_total: number };
export type SectorCost = { sector: string; original_cost_sum: number; revised_cost_sum: number; project_count: number };
export type ProgressPoint = { project_id: string; sector: string; physical_progress: number; financial_progress: number };
export type ProgressDivergence = { points: ProgressPoint[]; sampled: boolean; total_points: number; below_line_total: number };
export type SlaRuleBreakdown = { rule_key: SlaRuleId; rule_label: string; breach_count: number; threshold_label: string };
export type OverrunBucketKey = "on_time" | "0_6" | "6_12" | "12_24" | "24_plus";
export type OverrunBucket = { bucket_key: OverrunBucketKey; bucket_label: string; project_count: number; min_months: number | null; max_months: number | null };
export type StateDelays = { state: string; delayed_project_count: number; total_project_count: number };
export type PortfolioSummary = {
  kpis: PortfolioKpis;
  cost_by_sector: SectorCost[];
  progress_divergence: ProgressDivergence;
  sla_rule_breakdown: SlaRuleBreakdown[];
  schedule_overrun_histogram: OverrunBucket[];
  top_states: StateDelays[];
  /** The first rows of /sla/breaches, in that endpoint's exact order. */
  critical_watchlist: SlaBreachRow[];
  generated_at: string;
};

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_URL}/api/v1/portfolio/summary`);
  if (!response.ok) throw await readApiError(response, "Unable to load the portfolio summary");
  return response.json();
}

export type RecentAnalysis = { analysis_id: string; project_name: string; created_at: string; risk_band_or_score: string; risk_percentage: number };

export async function getRecentAnalyses(limit = 5): Promise<RecentAnalysis[]> {
  const response = await fetch(`${API_URL}/api/v1/analyses/recent?limit=${limit}`);
  if (!response.ok) throw await readApiError(response, "Unable to load recent analyses");
  return response.json();
}
