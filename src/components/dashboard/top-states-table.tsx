"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { StateDelays } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";

const SHOWN = 6;

/** Six states by count of projects past their planned duration; the bar is proportional to that count. */
export function TopStatesTable({ rows }: { rows: StateDelays[] }) {
  const router = useRouter();
  const shown = rows.slice(0, SHOWN);
  const max = Math.max(1, ...shown.map((r) => r.delayed_project_count));
  const summary = `States by delayed projects: ` + shown.map((r) => `${r.state} ${formatIndian(r.delayed_project_count)} of ${formatIndian(r.total_project_count)}`).join("; ") + ".";
  return (
    <Panel title="States by delayed projects" subtitle="Projects past planned duration. Click a state to list its projects." info="Delayed means project age past planned duration, the same measurement as the schedule-overrun SLA rule." summary={summary} className="span-4">
      <ul className="bar-list">
        {shown.map((r) => (
          <li key={r.state}>
            <button type="button" onClick={() => router.push(`/projects?state=${encodeURIComponent(r.state)}`)} aria-label={`${r.state}: ${formatIndian(r.delayed_project_count)} delayed of ${formatIndian(r.total_project_count)} projects. Open`}>
              <span className="bar-label"><strong>{r.state}</strong></span>
              <span className="bar-track"><i style={{ width: `${(r.delayed_project_count / max) * 100}%` }} /></span>
              <span className="bar-count">{formatIndian(r.delayed_project_count)}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
