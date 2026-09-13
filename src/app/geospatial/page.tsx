"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import GISCollisionChecker from "@/components/gis/GISCollisionChecker";

export default function GeospatialPage() {
  const [active, setActive] = useState("Geospatial view");
  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="Monitoring" title="Geospatial view" subtitle="Infrastructure map coverage for the current workspace." />
      <GISCollisionChecker />
    </AppShell>
  );
}
