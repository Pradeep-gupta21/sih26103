"use client";

import { useState } from "react";
import { ArrowUpRight, Gauge } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ScenarioPage() {
  const router = useRouter();
  const [active, setActive] = useState("Scenario lab");
  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="Decision support" title="Scenario lab" subtitle="Open a project intelligence report to adjust its intervention estimates." />
      <Card><EmptyState icon={<Gauge size={20} />} title="Choose a project before simulating" hint="The scenario simulator is available inside each project intelligence report and remains labeled as model estimates only." action={<Button variant="primary" onClick={() => router.push("/projects")}>Choose a project <ArrowUpRight size={14} aria-hidden="true" /></Button>} /></Card>
    </AppShell>
  );
}
