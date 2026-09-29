"use client";

/**
 * Map palette, layer definitions, and the legend.
 *
 * Kept in its own module, free of any Leaflet import, so the page can render the legend
 * and own the layer-toggle state without pulling the map bundle into the server render
 * (the map itself is loaded client-only through next/dynamic).
 */

import { CATEGORY_LABELS, type BoundaryCategory } from "@/lib/gis-api";

export { CATEGORY_COLORS, COLLISION_COLOR, BUFFER_COLOR, PROJECT_COLOR } from "./map-colors";
import { CATEGORY_COLORS } from "./map-colors";

export type LayerKey = "project" | "buffer" | "boundaries" | "intersecting" | "collisions";
export type LayerVisibility = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerVisibility = {
  project: true,
  buffer: true,
  boundaries: true,
  intersecting: true,
  collisions: true,
};

export const LAYER_OPTIONS: { key: LayerKey; label: string }[] = [
  { key: "project", label: "Project location" },
  { key: "buffer", label: "Analysis buffer" },
  { key: "boundaries", label: "All boundaries" },
  { key: "intersecting", label: "Detected boundaries" },
  { key: "collisions", label: "Collision areas" },
];

/**
 * Compact legend.
 *
 * `presentCategories` comes from the data actually on the map, and only adds the
 * catch-all "Other Restricted Zone" row when something on screen uses it -- a legend
 * entry for a colour nobody can see is noise.
 */
export function MapLegend({ presentCategories }: { presentCategories?: BoundaryCategory[] }) {
  const categories: BoundaryCategory[] = [
    "WILDLIFE_SANCTUARY",
    "NATIONAL_PARK",
    "FOREST",
    "ECO_SENSITIVE_ZONE",
    "TIGER_RESERVE",
    "RAMSAR_WETLAND",
  ];
  if (presentCategories?.includes("OTHER_RESTRICTED_ZONE")) categories.push("OTHER_RESTRICTED_ZONE");

  return (
    <ul className="gis-legend" aria-label="Map legend">
      <li>
        <i className="gis-legend-swatch project" aria-hidden />
        Project Location
      </li>
      <li>
        <i className="gis-legend-swatch buffer" aria-hidden />
        Analysis Buffer
      </li>
      {categories.map((category) => (
        <li key={category}>
          <i
            className="gis-legend-swatch"
            style={{ borderColor: CATEGORY_COLORS[category], background: `${CATEGORY_COLORS[category]}33` }}
            aria-hidden
          />
          {category === "RAMSAR_WETLAND" ? "Wetland" : CATEGORY_LABELS[category]}
        </li>
      ))}
      <li>
        <i className="gis-legend-swatch collision" aria-hidden />
        Collision Area
      </li>
    </ul>
  );
}
