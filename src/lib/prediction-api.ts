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