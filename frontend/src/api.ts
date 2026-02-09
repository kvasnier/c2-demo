import type * as GeoJSON from "geojson";

const API_BASE = "http://localhost:8000";

export type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

export async function fetchUnits(): Promise<FeatureCollection> {
  const r = await fetch(`${API_BASE}/units`);
  if (!r.ok) throw new Error("Failed to fetch units");
  return r.json();
}

export async function fetchPois(): Promise<FeatureCollection> {
  const r = await fetch(`${API_BASE}/pois`);
  if (!r.ok) throw new Error("Failed to fetch POIs");
  return r.json();
}

export async function createPoi(payload: { label: string; category: string; lat: number; lon: number }) {
  const r = await fetch(`${API_BASE}/pois`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to create POI");
  return r.json();
}

export async function createUnit(input: {
  name: string;
  side: "FRIEND" | "ENEMY" | "NEUTRAL";
  unit_type: "INFANTRY" | "ARMOR" | "ARTILLERY" | "UAS";
  echelon: "SECTION" | "BATTALION" | "BRIGADE";
  sidc: string;
  lat: number;
  lon: number;
}) {
  const r = await fetch(`${API_BASE}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`POST /units failed: ${r.status}`);
  return r.json();
}
