"use client";

import { useEffect } from "react";
import { BUFFER_STYLES, CATEGORY_STYLES, POPUP_TEXT, SEVERITY_STYLES } from "./map-colors";
import { MapContainer, TileLayer, Circle, Marker, Popup, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, Geometry } from "geojson";
import type { GISFeatureProperties, GISGeoJSON } from "@/lib/prediction-api";

// Fix default Leaflet icon paths in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

type GISMapProps = {
  center: { lat: number; lng: number };
  bufferDistanceKm: number;
  geojsonLayers?: GISGeoJSON;
  hasCollision?: boolean;
};

export default function GISMap({ center, bufferDistanceKm, geojsonLayers, hasCollision }: GISMapProps) {
  const position: [number, number] = [center.lat, center.lng];
  const bufferRadiusMeters = bufferDistanceKm * 1000;

  const getStyleForFeature = (feature?: Feature<Geometry, GISFeatureProperties>) => {
    const sev = feature?.properties?.collision_severity;
    const cat = feature?.properties?.category;

    if (sev === "CRITICAL") {
      return { ...SEVERITY_STYLES.CRITICAL };
    }
    if (sev === "HIGH") {
      return { ...SEVERITY_STYLES.HIGH };
    }
    if (sev === "WARNING") {
      return { ...SEVERITY_STYLES.WARNING };
    }

    // Default category styling
    switch (cat) {
      case "Tiger Reserve":
      case "National Park":
        return { ...CATEGORY_STYLES.reserve };
      case "Ramsar Wetland":
        return { ...CATEGORY_STYLES.wetland };
      case "Wildlife Sanctuary":
      case "Eco-Sensitive Zone":
        return { ...CATEGORY_STYLES.sensitive };
      default:
        return { ...CATEGORY_STYLES.other };
    }
  };

  const onEachFeature = (feature: Feature<Geometry, GISFeatureProperties>, layer: L.Layer) => {
    const props = feature?.properties || {};
    if (props.name) {
      const content = `
        <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
          <strong style="color: ${POPUP_TEXT.heading}; font-size: 12px; display: block; margin-bottom: 3px;">${props.name}</strong>
          <span style="color: ${POPUP_TEXT.label}; display: block; font-weight: 600;">Category: ${props.category || 'Protected Zone'}</span>
          <span style="color: ${POPUP_TEXT.muted}; display: block; margin-top: 2px;">State: ${props.state || 'N/A'}</span>
          ${props.clearance_type_required ? `<div style="margin-top: 6px; font-size: 10px; color: ${POPUP_TEXT.alert}; font-weight: 600;">Clearance: ${props.clearance_type_required}</div>` : ''}
        </div>
      `;
      layer.bindPopup(content);
    }
  };

  return (
    <div style={{ height: "100%", width: "100%", position: "relative", minHeight: "420px", borderRadius: "6px", overflow: "hidden" }}>
      <MapContainer center={position} zoom={9} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={center.lat} lng={center.lng} />

        {/* Project Location Marker */}
        <Marker position={position}>
          <Popup>
            <div style={{ fontFamily: "sans-serif", fontSize: "11px" }}>
              <strong style={{ display: "block", color: POPUP_TEXT.heading }}>Project Coordinates</strong>
              <span>Lat: {center.lat.toFixed(4)}, Lng: {center.lng.toFixed(4)}</span>
            </div>
          </Popup>
        </Marker>

        {/* Buffer Circle */}
        <Circle
          center={position}
          radius={bufferRadiusMeters}
          pathOptions={{
            color: hasCollision ? BUFFER_STYLES.collision.color : BUFFER_STYLES.clear.color,
            fillColor: hasCollision ? BUFFER_STYLES.collision.fillColor : BUFFER_STYLES.clear.fillColor,
            fillOpacity: 0.2,
            weight: 2,
            dashArray: "6, 6",
          }}
        />

        {/* GeoJSON Protected Area Boundaries Overlay */}
        {geojsonLayers && geojsonLayers.features && (
          <GeoJSON
            key={JSON.stringify(geojsonLayers)}
            data={geojsonLayers}
            style={getStyleForFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
