import "leaflet/dist/leaflet.css";
import L from "leaflet";
import ms from "milsymbol";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeafletMouseEvent } from "leaflet";
import type { FeatureCollection } from "./api";
import { createUnit, fetchUnits } from "./api";

type UnitProps = {
  id: string;
  name: string;
  side: "FRIEND" | "ENEMY" | "NEUTRAL";
  unit_type: "INFANTRY" | "ARMOR" | "ARTILLERY" | "UAS";
  echelon?: "SECTION" | "BATTALION" | "BRIGADE";
  sidc?: string;
};

type PointFeature<P> = GeoJSON.Feature<GeoJSON.Point, P>;

type UnitDraft = {
  name: string;
  side: "FRIEND" | "ENEMY" | "NEUTRAL";
  unit_type: "INFANTRY" | "ARMOR" | "ARTILLERY" | "UAS";
  echelon: "SECTION" | "BATTALION" | "BRIGADE";
  sidc: string;
};

/*function makeApp6Icon(sidc: string) {
  const sym = new ms.Symbol(sidc, { size: 40, frame: true });
  const svg = sym.asSVG();
  return L.divIcon({
    className: "app6-marker",
    html: svg,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}*/

function makeApp6Icon(sidc: string, zoom: number) {
  const size = iconSizeForZoom(zoom);

  const sym = new ms.Symbol(sidc, {
    size,
    frame: true,
  });

  const svg = sym.asSVG();

  return L.divIcon({
    className: "app6-marker",
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({
    zoom: (e) => onZoom(e.target.getZoom()),
    zoomend: (e) => onZoom(e.target.getZoom()),
  });
  return null;
}

// MVP SIDC (démo) — suffisant pour rendu milsymbol
function sidcFor(d: UnitDraft): string {
  const aff = d.side === "FRIEND" ? "F" : d.side === "ENEMY" ? "H" : "N";
  if (d.unit_type === "ARMOR") return `S${aff}GPUCA----K`;
  if (d.unit_type === "ARTILLERY") return `S${aff}GPUCF----K`;
  if (d.unit_type === "UAS") return `S${aff}AUU-----K--`;
  return `S${aff}GPUCI----K`;
}

function MapClickHandler({
  placing,
  onPlaced,
}: {
  placing: UnitDraft | null;
  onPlaced: () => void;
}) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      void (async () => {
        if (!placing) return;

        await createUnit({
          ...placing,
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        });

        onPlaced();
      })();
    },
  });

  return null;
}

function RightToolbar({
  onAddUnit,
  onCancel,
  placing,
}: {
  onAddUnit: () => void;
  onCancel: () => void;
  placing: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 72,
        zIndex: 9999,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <button
        onClick={() => {
          console.log("ADD UNIT CLICK");
          onAddUnit();
        }}
        style={toolBtn}
        title="Add unit"
      >
        ＋
      </button>

      {placing && (
        <button onClick={onCancel} style={{ ...toolBtn, opacity: 0.9 }} title="Cancel placement">
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
  pointerEvents: "auto",
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

  const draftBase: Omit<UnitDraft, "sidc"> = {
    name,
    side,
    unit_type: unitType,
    echelon,
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
            <input style={input} value={sidcFor({ ...draftBase, sidc: "" })} readOnly />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button style={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={primaryBtn}
            onClick={() => {
              const sidc = sidcFor({ ...draftBase, sidc: "" });
              onConfirm({ ...draftBase, sidc });
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
  pointerEvents: "auto",
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

  // Zoom
  const [zoom, setZoom] = useState<number>(12);

  const [units, setUnits] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [placing, setPlacing] = useState<UnitDraft | null>(null);

  const load = useCallback(async () => {
    try {
      const u = await fetchUnits();
      setUnits(u);
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

        // Watch zoom level to adjust unit icon sizes 
        <ZoomWatcher onZoom={setZoom} />

        <MapClickHandler
          placing={placing}
          onPlaced={() => {
            setPlacing(null);
            void load();
          }}
        />

        {/* Units */}
        {unitFeatures.map((f) => {
          const [lon, lat] = f.geometry.coordinates;
          const sidc = f.properties.sidc;
          //const icon = sidc ? makeApp6Icon(sidc) : undefined;
          const icon = sidc ? makeApp6Icon(sidc, zoom) : undefined;

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
      </MapContainer>

      <RightToolbar
        onAddUnit={() => setUnitModalOpen(true)}
        onCancel={() => setPlacing(null)}
        placing={placing !== null}
      />

      <UnitModal
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        onConfirm={(d) => {
          setUnitModalOpen(false);
          setPlacing(d);
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
          {placing ? `Placement: click map to place ${placing.name}` : "Ready"}
        </div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Units: {unitFeatures.length}</div>
        {error && <div style={{ marginTop: 6, color: "#ffb4b4" }}>{error}</div>}
      </div>

      <style>{`
        .app6-marker { background: transparent; border: none; }
        .app6-marker svg { display:block; }
        .leaflet-container { z-index: 0; }
      `}</style>
    </div>
  );
}

function iconSizeForZoom(zoom: number): number {
  const min = 8;    // très petit au dézoom
  const max = 48;

  const zMin = 4;
  const zMax = 16;

  const clamped = Math.max(zMin, Math.min(zMax, zoom));
  let t = (clamped - zMin) / (zMax - zMin);

  // Non-linéaire : shrink plus agressif quand t est bas
  // (t^1.7 → plus petit rapidement au dézoom)
  t = Math.pow(t, 1.7);

  return Math.round(min + t * (max - min));
}
