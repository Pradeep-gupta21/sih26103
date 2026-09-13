"use client";

import { useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Reached from the sidebar when no project report is open; the interventions themselves are section 04 of each report. */
export default function InterventionsPage() {
  const router = useRouter();
  const [active, setActive] = useState("Interventions");
  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="Decision support" title="Interventions" subtitle="Open a project intelligence report to review its recommended interventions." />
      <Card><EmptyState icon={<ShieldCheck size={20} />} title="Choose a project before reviewing interventions" hint="Recommended interventions live inside each project intelligence report, ranked for that project. A project must be opened first." action={<Button variant="primary" onClick={() => router.push("/projects")}>Choose a project <ArrowUpRight size={14} aria-hidden="true" /></Button>} /></Card>
    </AppShell>
  );
}
