/**
 * Every literal colour used on the Leaflet maps, in one place. Leaflet paints SVG paths
 * and popup HTML outside the document's CSS cascade, so these cannot be CSS variables.
 * Everything else in the application takes its colours from globals.css.
 */
import type { BoundaryCategory } from "@/lib/gis-api";

/** One colour per boundary category on the boundary check map and its legend. */
export const CATEGORY_COLORS: Record<BoundaryCategory, string> = {
  WILDLIFE_SANCTUARY: "#6b8f5e",
  NATIONAL_PARK: "#3f7a55",
  FOREST: "#7a8b46",
  ECO_SENSITIVE_ZONE: "#b08a3c",
  TIGER_RESERVE: "#b5623a",
  RAMSAR_WETLAND: "#4a7f96",
  OTHER_RESTRICTED_ZONE: "#7d7f88",
};
export const COLLISION_COLOR = "#c7543f";
export const BUFFER_COLOR = "#31463a";
export const PROJECT_COLOR = "#1c211f";
export const PROJECT_MARKER_FILL = "#f8f9f7";

/** The older collision-checker map (/geospatial): severity and category fills, buffer circle, popup text. */
export const SEVERITY_STYLES = {
  CRITICAL: { color: "#be4d3c", fillColor: "#fae8e3", fillOpacity: 0.55, weight: 2 },
  HIGH: { color: "#c16b3f", fillColor: "#fbede0", fillOpacity: 0.45, weight: 2 },
  WARNING: { color: "#aa893d", fillColor: "#f7f1dc", fillOpacity: 0.35, weight: 1.5 },
} as const;
export const CATEGORY_STYLES = {
  reserve: { color: "#bd4f3c", fillColor: "#fae8e3", fillOpacity: 0.3, weight: 1.5 },
  wetland: { color: "#4f8a63", fillColor: "#e7f1e8", fillOpacity: 0.3, weight: 1.5 },
  sensitive: { color: "#ad893e", fillColor: "#f7f1df", fillOpacity: 0.3, weight: 1.5 },
  other: { color: "#547e9b", fillColor: "#e7eff4", fillOpacity: 0.25, weight: 1 },
} as const;
export const BUFFER_STYLES = {
  collision: { color: "#c95740", fillColor: "#f0d9d3" },
  clear: { color: "#4a8a69", fillColor: "#d3e1d4" },
} as const;
export const POPUP_TEXT = { heading: "#27382e", label: "#7d8a81", muted: "#8b968f", alert: "#be4d3c" } as const;
