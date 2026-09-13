"use client";

import { useState } from "react";
import { ArrowUpRight, Gauge } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { EmptyState } from "@/components/ui/empty-state";

export default function ScenarioPage() {
  const router = useRouter();
  const [active, setActive] = useState("Scenario lab");
  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><TopBar title="SCENARIO LAB" /><div className="content-wrap"><header className="intro"><div><span className="eyebrow"><Gauge size={13} /> DECISION SUPPORT</span><h1>Scenario lab</h1><p>Open a project intelligence report to adjust its intervention estimates.</p></div></header><EmptyState icon={<Gauge size={17} />} eyebrow="PROJECT REQUIRED" title="Choose a project before simulating." actions={<button className="dark-button" onClick={() => router.push("/projects")}>Choose a project <ArrowUpRight size={14} /></button>}><p>The scenario simulator is available inside each project intelligence report and remains labeled as model estimates only.</p></EmptyState></div></main></div>;
}
