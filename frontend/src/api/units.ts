import type { Unit } from "../types/unit";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function fetchUnits(): Promise<Unit[]> {
  const r = await fetch(`${API_BASE}/units`);
  if (!r.ok) throw new Error(`GET /units failed: ${r.status}`);
  return r.json();
}

export async function createUnit(input: Omit<Unit, "id">): Promise<Unit> {
  const r = await fetch(`${API_BASE}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`POST /units failed: ${r.status}`);
  return r.json();
}
