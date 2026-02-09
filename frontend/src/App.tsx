import "leaflet/dist/leaflet.css";
import L from "leaflet";
import ms from "milsymbol";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeafletMouseEvent } from "leaflet";
import type { FeatureCollection } from "./api";
import { createPoi, createUnit, fetchPois, fetchUnits } from "./api";

type UnitProps = {
  id: string;
  name: string;
  side: "FRIEND" | "ENEMY" | "NEUTRAL";
  unit_type: "INFANTRY" | "ARMOR" | "ARTILLERY" | "UAS";
  echelon?: "SECTION" | "BATTALION" | "BRIGADE";
  sidc?: string;
};

type PoiProps = {
  id: string;
  label: string;
  category: string;
};

type PointFeature<P> = GeoJSON.Feature<GeoJSON.Point, P>;

type UnitDraft = {
  name: string;
  side: "FRIEND" | "ENEMY" | "NEUTRAL";
  unit_type: "INFANTRY" | "ARMOR" | "ARTILLERY" | "UAS";
  echelon: "SECTION" | "BATTALION" | "BRIGADE";
  sidc: string;
};

function makeApp6Icon(sidc: string) {
  const sym = new ms.Symbol(sidc, { size: 40, frame: true });
  const svg = sym.asSVG();
  return L.divIcon({
    className: "app6-marker",
    html: svg,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

// MVP SIDC “démo” (APP6/2525-like) : suffisant pour rendre un symbole cohérent et varier l’affiliation.
// On pourra remplacer par une table SIDC exacte plus tard.
function sidcFor(d: UnitDraft): string {
  const aff = d.side === "FRIEND" ? "F" : d.side === "ENEMY" ? "H" : "N";
  // Base “ground unit”
  const base = `S${aff}GPUCI----K`; // infantry-ish
  if (d.unit_type === "ARMOR") return `S${aff}GPUCA----K`; // armor-ish
  if (d.unit_type === "ARTILLERY") return `S${aff}GPUCF----K`; // arty-ish
  if (d.unit_type === "UAS") return `S${aff}AUU-----K--`; // air/uas-ish (démo)
  return base;
}

function MapClickHandler({
  mode,
  unitDraft,
  onCreated,
  onCancelPlacement,
}: {
  mode: "POI" | "UNIT" | null;
  unitDraft: UnitDraft | null;
  onCreated: () => void;
  onCancelPlacement: () => void;
}) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      void (async () => {
        if (mode === "POI") {
          const label = prompt("Nom du POI ?")?.trim();
          if (!label) return;

          const category = prompt("Catégorie ? (ex: PC, Vehicle, Antenna)")?.trim() || "Unknown";

          await createPoi({
            label,
            category,
            lat: e.latlng.lat,
            lon: e.latlng.lng,
          });

          onCreated();
          return;
        }

        if (mode === "UNIT" && unitDraft) {
          await createUnit({ ...unitDraft, lat: e.latlng.lat, lon: e.latlng.lng })

          onCancelPlacement();
          onCreated();
        }
      })();
    },
  });

  return null;
}

function RightToolbar({
  onAddUnit,
  onPoiMode,
  onCancel,
  placing,
}: {
  onAddUnit: () => void;
  onPoiMode: () => void;
  onCancel: () => void;
  placing: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 72,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <button onClick={() => {
          console.log("ADD UNIT CLICK");
          onAddUnit();
        }}
        style={toolBtn}>
        ＋
      </button>
      <button onClick={onPoiMode} style={toolBtn} title="Créer un POI">
        ⬤
      </button>
      {placing && (
        <button onClick={onCancel} style={{ ...toolBtn, opacity: 0.9 }} title="Annuler placement">
          ✕
        </button>
      )}
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(20,24,28,0.85)",
  color: "white",
  cursor: "pointer",
  fontSize: 18,
};

function UnitModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (d: UnitDraft) => void;
}) {
  const [name, setName] = useState("New unit");
  const [side, setSide] = useState<UnitDraft["side"]>("FRIEND");
  const [unitType, setUnitType] = useState<UnitDraft["unit_type"]>("INFANTRY");
  const [echelon, setEchelon] = useState<UnitDraft["echelon"]>("SECTION");

  if (!open) return null;

  const draft: UnitDraft = {
    name,
    side,
    unit_type: unitType,
    echelon,
    sidc: "", // recalculé à la confirmation
  };

  return (
    <div style={backdrop} onClick={onClose}>
        <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Add unit</div>
          <button style={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={label}>Name</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
          <div>
            <label style={label}>Side</label>
            <select style={input} value={side} onChange={(e) => setSide(e.target.value as UnitDraft["side"])}>
              <option value="FRIEND">Friend</option>
              <option value="ENEMY">Enemy</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </div>

          <div>
            <label style={label}>Type</label>
            <select
              style={input}
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitDraft["unit_type"])}
            >
              <option value="INFANTRY">Infantry</option>
              <option value="ARMOR">Armor</option>
              <option value="ARTILLERY">Artillery</option>
              <option value="UAS">Drone (UAS)</option>
            </select>
          </div>

          <div>
            <label style={label}>Echelon</label>
            <select style={input} value={echelon} onChange={(e) => setEchelon(e.target.value as UnitDraft["echelon"])}>
              <option value="SECTION">Section</option>
              <option value="BATTALION">Battalion</option>
              <option value="BRIGADE">Brigade</option>
            </select>
          </div>

          <div>
            <label style={label}>Preview SIDC</label>
            <input style={input} value={sidcFor({ ...draft, sidc: "" })} readOnly />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button style={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={primaryBtn}
            onClick={() => {
              const sidc = sidcFor(draft);
              onConfirm({ ...draft, sidc });
            }}
          >
            Place on map
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 20000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const modal: React.CSSProperties = {
  width: 560,
  borderRadius: 16,
  padding: 16,
  background: "rgba(20,24,28,0.95)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  fontFamily: "system-ui",
};
const label: React.CSSProperties = { display: "block", marginBottom: 6, opacity: 0.9, fontSize: 12 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
};
const closeBtn: React.CSSProperties = { ...input, width: 40, height: 40, padding: 0, cursor: "pointer" };
const primaryBtn: React.CSSProperties = { ...input, width: "auto", cursor: "pointer", background: "rgba(0,120,255,0.35)" };
const secondaryBtn: React.CSSProperties = { ...input, width: "auto", cursor: "pointer" };

export default function App() {
  const center: [number, number] = [48.8566, 2.3522];

  const [units, setUnits] = useState<FeatureCollection | null>(null);
  const [pois, setPois] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"POI" | "UNIT" | null>(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitDraft, setUnitDraft] = useState<UnitDraft | null>(null);

  const load = useCallback(async () => {
    try {
      const u = await fetchUnits();
      setUnits(u);
      setPois({ type: "FeatureCollection", features: [] } as FeatureCollection); // si tu gardes le state pois
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const unitFeatures = useMemo(() => (units?.features ?? []) as Array<PointFeature<UnitProps>>, [units]);
  const poiFeatures = useMemo(() => (pois?.features ?? []) as Array<PointFeature<PoiProps>>, [pois]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          maxZoom={19}
        />
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri"
          maxZoom={19}
        />

        <MapClickHandler
          mode={mode}
          unitDraft={unitDraft}
          onCreated={load}
          onCancelPlacement={() => {
            setMode(null);
            setUnitDraft(null);
          }}
        />

        {/* Units */}
        {unitFeatures.map((f) => {
          const [lon, lat] = f.geometry.coordinates;
          const sidc = f.properties.sidc;
          const icon = sidc ? makeApp6Icon(sidc) : undefined;

          return (
            <Marker key={f.properties.id} position={[lat, lon]} icon={icon}>
              <Popup>
                <div style={{ fontFamily: "system-ui" }}>
                  <div style={{ fontWeight: 700 }}>{f.properties.name}</div>
                  <div>Side: {f.properties.side}</div>
                  <div>Type: {f.properties.unit_type}</div>
                  {f.properties.echelon && <div>Echelon: {f.properties.echelon}</div>}
                  {f.properties.sidc && <div>SIDC: {f.properties.sidc}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* POIs */}
        {poiFeatures.map((f) => {
          const [lon, lat] = f.geometry.coordinates;
          return (
            <Marker key={f.properties.id} position={[lat, lon]}>
              <Popup>
                <div style={{ fontFamily: "system-ui" }}>
                  <div style={{ fontWeight: 700 }}>{f.properties.label}</div>
                  <div>Category: {f.properties.category}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <RightToolbar
        onAddUnit={() => setUnitModalOpen(true)}
        onPoiMode={() => {
          setMode("POI");
          setUnitDraft(null);
        }}
        onCancel={() => {
          setMode(null);
          setUnitDraft(null);
        }}
        placing={mode !== null}
      />

      <UnitModal
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        onConfirm={(d) => {
          setUnitModalOpen(false);
          setUnitDraft(d);
          setMode("UNIT");
        }}
      />

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: 10,
          background: "rgba(0,0,0,0.6)",
          color: "white",
          borderRadius: 8,
          fontFamily: "system-ui",
          maxWidth: 360,
          zIndex: 1100,
        }}
      >
        <div style={{ fontWeight: 700 }}>C2 Demo</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          Mode:{" "}
          {mode === "POI"
            ? "Créer POI (clic carte)"
            : mode === "UNIT"
            ? `Placer unité: ${unitDraft?.name ?? ""} (clic carte)`
            : "Aucun"}
        </div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Units: {unitFeatures.length} | POIs: {poiFeatures.length}
        </div>
        {error && <div style={{ marginTop: 6, color: "#ffb4b4" }}>{error}</div>}
      </div>

      {/* petit style global */}
      <style>{`
        .app6-marker { background: transparent; border: none; }
        .app6-marker svg { display:block; }
      `}</style>
    </div>
  );
}
