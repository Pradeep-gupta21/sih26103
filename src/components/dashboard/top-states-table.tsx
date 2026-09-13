"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { StateDelays } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";

/** Ten states by count of projects past their planned duration; the bar is proportional to that count. */
export function TopStatesTable({ rows }: { rows: StateDelays[] }) {
  const router = useRouter();
  const max = Math.max(1, ...rows.map((r) => r.delayed_project_count));
  const summary = `States by delayed projects: ` + rows.map((r) => `${r.state} ${formatIndian(r.delayed_project_count)} of ${formatIndian(r.total_project_count)}`).join("; ") + ".";
  return (
    <Panel eyebrow="GEOGRAPHY" title="States by delayed projects" summary={summary} caption="Delayed means project age past planned duration, the same measurement as the schedule-overrun SLA rule. Click a state to list its projects.">
      <table className="overview-states">
        <thead><tr><th scope="col">State</th><th scope="col" className="visually-hidden">Share</th><th scope="col">Delayed</th><th scope="col" className="visually-hidden">Open</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.state}>
              <td><button className="overview-row-link" onClick={() => router.push(`/projects?state=${encodeURIComponent(r.state)}`)} aria-label={`${r.state}: ${formatIndian(r.delayed_project_count)} delayed of ${formatIndian(r.total_project_count)} projects. Open`}>{r.state}</button></td>
              <td className="overview-states-bar"><i style={{ width: `${(r.delayed_project_count / max) * 100}%` }} /></td>
              <td className="overview-states-count"><strong>{formatIndian(r.delayed_project_count)}</strong> <small>of {formatIndian(r.total_project_count)}</small></td>
              <td className="overview-states-arrow"><ArrowUpRight size={14} aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
