import type * as GeoJSON from "geojson";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;
export type HealthStatus = { status: "ok"; boot_id: string };
export type Side = "FRIEND" | "ENEMY" | "NEUTRAL" | "UNKNOWN";
export type UnitType =
  | "INFANTRY"
  | "ARMOR"
  | "ARTILLERY"
  | "COMMAND_POST"
  | "UAS"
  | "UAS_ATTACK"
  | "UAS_BOMBER"
  | "UAS_CARGO"
  | "UAS_COMMAND_POST"
  | "UAS_FIGHTER"
  | "UAS_CSAR"
  | "UAS_JAMMER"
  | "UAS_TANKER"
  | "UAS_VTOL"
  | "UAS_SOF"
  | "UAS_MCM"
  | "UAS_ASUW"
  | "UAS_PATROL"
  | "UAS_RECON"
  | "UAS_AEW"
  | "UAS_ESM"
  | "UAS_PHOTOGRAPHIC"
  | "UAS_ASW"
  | "UAS_TRAINER"
  | "UAS_UTILITY"
  | "UAS_COMM"
  | "UAS_MEDEVAC";
export type Echelon = "SECTION" | "BATTALION" | "BRIGADE";

export async function fetchUnits(): Promise<FeatureCollection> {
  const r = await fetch(`${API_BASE}/units`);
  if (!r.ok) throw new Error("Failed to fetch units");
  return r.json();
}

export async function fetchHealth(): Promise<HealthStatus> {
  const r = await fetch(`${API_BASE}/health`);
  if (!r.ok) throw new Error(`GET /health failed: ${r.status}`);
  return r.json();
}

export async function createUnit(input: {
  name: string;
  side: Side;
  unit_type: UnitType;
  echelon: Echelon;
  sidc: string;
  lat: number;
  lon: number;
}) {
  try {
    const r = await fetch(`${API_BASE}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error(`POST /units failed: ${r.status}`);
    return r.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Impossible de joindre l'API (${API_BASE}). Vérifie que le backend est démarré et accessible.`
      );
    }
    throw err;
  }
}

export async function deleteUnit(unitId: string): Promise<{ ok: boolean; id: string }> {
  try {
    const r = await fetch(`${API_BASE}/units/${unitId}`, {
      method: "DELETE",
    });
    if (!r.ok) throw new Error(`DELETE /units/${unitId} failed: ${r.status}`);
    return r.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Impossible de joindre l'API (${API_BASE}). Verifie que le backend est demarre et accessible.`
      );
    }
    throw err;
  }
}

export async function updateUnit(
  unitId: string,
  input: {
    side?: Side;
    sidc?: string;
  }
) {
  try {
    const r = await fetch(`${API_BASE}/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error(`PATCH /units/${unitId} failed: ${r.status}`);
    return r.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Impossible de joindre l'API (${API_BASE}). Verifie que le backend est demarre et accessible.`
      );
    }
    throw err;
  }
}

export async function resetScenario(): Promise<{ ok: boolean; restored_units: number; backup_path: string }> {
  try {
    const r = await fetch(`${API_BASE}/scenario/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) throw new Error(`POST /scenario/reset failed: ${r.status}`);
    return r.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Impossible de joindre l'API (${API_BASE}). Vérifie que le backend est démarré et accessible.`
      );
    }
    throw err;
  }
}
