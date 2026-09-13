"use client";

import { useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { EmptyState } from "@/components/ui/empty-state";

/** Reached from the sidebar when no project report is open; the interventions themselves are section 04 of each report. */
export default function InterventionsPage() {
  const router = useRouter();
  const [active, setActive] = useState("Interventions");
  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><TopBar title="INTERVENTIONS" /><div className="content-wrap"><header className="intro"><div><span className="eyebrow"><ShieldCheck size={13} /> DECISION SUPPORT</span><h1>Interventions</h1><p>Open a project intelligence report to review its recommended interventions.</p></div></header><EmptyState icon={<ShieldCheck size={17} />} eyebrow="PROJECT REQUIRED" title="Choose a project before reviewing interventions." actions={<button className="dark-button" onClick={() => router.push("/projects")}>Choose a project <ArrowUpRight size={14} /></button>}><p>Recommended interventions live inside each project intelligence report, ranked for that project. A project must be opened first.</p></EmptyState></div></main></div>;
}
