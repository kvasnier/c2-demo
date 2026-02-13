import "leaflet/dist/leaflet.css";
import L from "leaflet";
import ms from "milsymbol";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeafletMouseEvent, Marker as LeafletMarker } from "leaflet";
import type { FeatureCollection } from "./api";
import { API_BASE, createUnit, deleteUnit, fetchHealth, fetchUnits, resetScenario, updateUnit } from "./api";
import { ChatPanel } from "./components/ChatPanel";

type Side = "FRIEND" | "ENEMY" | "NEUTRAL" | "UNKNOWN";
type UnitType =
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

type Echelon = "SECTION" | "BATTALION" | "BRIGADE";

type UnitProps = {
  id: string;
  name: string;
  side: Side;
  unit_type: UnitType;
  echelon?: Echelon;
  sidc?: string;
};

type PointFeature<P> = GeoJSON.Feature<GeoJSON.Point, P>;

type UnitDraft = {
  name: string;
  side: Side;
  unit_type: UnitType;
  echelon: Echelon;
  sidc: string;
};

type MissionOrderDraft = {
  title: string;
  situation: string;
  mission: string;
  execution: string;
  soutien: string;
  commandementTransmissions: string;
  droneId: string;
  droneName: string;
};

type ChatAction = {
  type: string;
  payload: Record<string, unknown>;
};

type ExternalChatPrompt = {
  key: number;
  content: string;
};

type ReconOrderGraphic = {
  droneId: string;
  droneName: string;
  from: [number, number];
  to: [number, number];
};

const APP6_BY_UNIT_TYPE: Record<UnitType, { dimension: "G" | "A"; functionId: string; label: string }> = {
  INFANTRY: { dimension: "G", functionId: "UCI---", label: "Infantry" },
  ARMOR: { dimension: "G", functionId: "UCA---", label: "Armor" },
  ARTILLERY: { dimension: "G", functionId: "UCF---", label: "Artillery" },
  COMMAND_POST: { dimension: "G", functionId: "UH1---", label: "Command post (HQ)" },
  UAS: { dimension: "A", functionId: "MFQ---", label: "UAS - Generic" },
  UAS_ATTACK: { dimension: "A", functionId: "MFQA--", label: "UAS - Attack" },
  UAS_BOMBER: { dimension: "A", functionId: "MFQB--", label: "UAS - Bomber" },
  UAS_CARGO: { dimension: "A", functionId: "MFQC--", label: "UAS - Cargo" },
  UAS_COMMAND_POST: { dimension: "A", functionId: "MFQD--", label: "UAS - Command post" },
  UAS_FIGHTER: { dimension: "A", functionId: "MFQF--", label: "UAS - Fighter" },
  UAS_CSAR: { dimension: "A", functionId: "MFQH--", label: "UAS - CSAR" },
  UAS_JAMMER: { dimension: "A", functionId: "MFQJ--", label: "UAS - Jammer/ECM" },
  UAS_TANKER: { dimension: "A", functionId: "MFQK--", label: "UAS - Tanker" },
  UAS_VTOL: { dimension: "A", functionId: "MFQL--", label: "UAS - VTOL" },
  UAS_SOF: { dimension: "A", functionId: "MFQM--", label: "UAS - SOF" },
  UAS_MCM: { dimension: "A", functionId: "MFQI--", label: "UAS - Mine countermeasures" },
  UAS_ASUW: { dimension: "A", functionId: "MFQN--", label: "UAS - Anti-surface warfare" },
  UAS_PATROL: { dimension: "A", functionId: "MFQP--", label: "UAS - Patrol" },
  UAS_RECON: { dimension: "A", functionId: "MFQR--", label: "UAS - Recon" },
  UAS_AEW: { dimension: "A", functionId: "MFQRW-", label: "UAS - Airborne early warning" },
  UAS_ESM: { dimension: "A", functionId: "MFQRZ-", label: "UAS - Electronic surveillance" },
  UAS_PHOTOGRAPHIC: { dimension: "A", functionId: "MFQRX-", label: "UAS - Photographic" },
  UAS_ASW: { dimension: "A", functionId: "MFQS--", label: "UAS - Anti-submarine warfare" },
  UAS_TRAINER: { dimension: "A", functionId: "MFQT--", label: "UAS - Trainer" },
  UAS_UTILITY: { dimension: "A", functionId: "MFQU--", label: "UAS - Utility" },
  UAS_COMM: { dimension: "A", functionId: "MFQY--", label: "UAS - Communications" },
  UAS_MEDEVAC: { dimension: "A", functionId: "MFQO--", label: "UAS - Medevac" },
};

const SURFACE_UNIT_TYPES: UnitType[] = ["INFANTRY", "ARMOR", "ARTILLERY", "COMMAND_POST"];
const DRONE_UNIT_TYPES: UnitType[] = [
  "UAS",
  "UAS_ATTACK",
  "UAS_BOMBER",
  "UAS_CARGO",
  "UAS_COMMAND_POST",
  "UAS_FIGHTER",
  "UAS_CSAR",
  "UAS_JAMMER",
  "UAS_TANKER",
  "UAS_VTOL",
  "UAS_SOF",
  "UAS_MCM",
  "UAS_ASUW",
  "UAS_PATROL",
  "UAS_RECON",
  "UAS_AEW",
  "UAS_ESM",
  "UAS_PHOTOGRAPHIC",
  "UAS_ASW",
  "UAS_TRAINER",
  "UAS_UTILITY",
  "UAS_COMM",
  "UAS_MEDEVAC",
];

const SCENARIO_HQ = {
  name: "RUS-HQ-COMINT",
  side: "UNKNOWN" as const,
  unit_type: "COMMAND_POST" as const,
  echelon: "BRIGADE" as const,
  lat: 48.247165,
  lon: 39.950965,
};

const RECON_LINK_PREFIX = "/map/uav-recon/";

function normalizeUnitName(name: string): string {
  return name.trim().toUpperCase();
}

function extractPathFromUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  }
  return url;
}

function reconUnitNameFromLink(url: string): string | null {
  const path = extractPathFromUrl(url);
  if (!path.startsWith(RECON_LINK_PREFIX)) return null;
  const encodedName = path.slice(RECON_LINK_PREFIX.length);
  if (!encodedName) return null;
  try {
    return normalizeUnitName(decodeURIComponent(encodedName));
  } catch {
    return null;
  }
}

function payloadString(payload: Record<string, unknown>, key: string, fallback: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

const EARTH_RADIUS_M = 6371000;

function toRad(v: number): number {
  return (v * Math.PI) / 180;
}

function toDeg(v: number): number {
  return (v * 180) / Math.PI;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const la1 = toRad(lat1);
  const la2 = toRad(lat2);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function moveTowards(a: [number, number], b: [number, number], stepMeters: number): [number, number] {
  const dist = haversineMeters(a, b);
  if (dist <= 1e-6 || stepMeters >= dist) return b;
  const t = stepMeters / dist;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function bearingRadians(from: [number, number], to: [number, number]): number {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

function destinationPoint(center: [number, number], distanceMeters: number, bearingRad: number): [number, number] {
  const [lat, lon] = center;
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);
  const delta = distanceMeters / EARTH_RADIUS_M;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(bearingRad)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [toDeg(phi2), toDeg(lambda2)];
}

function makeApp6Icon(sidc: string, zoom: number, highlighted = false) {
  const size = iconSizeForZoom(zoom) + (highlighted ? 6 : 0);

  const sym = new ms.Symbol(sidc, {
    size,
    frame: true,
  });

  const svg = sym.asSVG();

  return L.divIcon({
    className: highlighted ? "app6-marker app6-marker-highlighted" : "app6-marker",
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
  const aff = d.side === "FRIEND" ? "F" : d.side === "ENEMY" ? "H" : d.side === "NEUTRAL" ? "N" : "U";
  const modifier2 = d.echelon === "SECTION" ? "C" : d.echelon === "BATTALION" ? "F" : "H";
  const mapping = APP6_BY_UNIT_TYPE[d.unit_type];
  return `S${aff}${mapping.dimension}P${mapping.functionId}-${modifier2}`;
}

type FocusRequest = {
  key: number;
  lat: number;
  lon: number;
};

function MapFocusController({ request }: { request: FocusRequest | null }) {
  const map = useMap();

  useEffect(() => {
    if (!request) return;
    map.setView([request.lat, request.lon], Math.max(map.getZoom(), 13), { animate: true });
  }, [map, request]);

  return null;
}

function findScenarioHQFeature(features: Array<PointFeature<UnitProps>>): PointFeature<UnitProps> | null {
  const tolerance = 1e-4;
  return (
    features.find((f) => {
      const normalizedName = (f.properties.name ?? "").trim().toUpperCase();
      if (normalizedName === SCENARIO_HQ.name) return true;

      const [lon, lat] = f.geometry.coordinates;
      return (
        f.properties.side === SCENARIO_HQ.side &&
        f.properties.unit_type === SCENARIO_HQ.unit_type &&
        f.properties.echelon === SCENARIO_HQ.echelon &&
        Math.abs(lat - SCENARIO_HQ.lat) <= tolerance &&
        Math.abs(lon - SCENARIO_HQ.lon) <= tolerance
      );
    }) ?? null
  );
}

function MapClickHandler({
  placing,
  onPlaced,
  onError,
}: {
  placing: UnitDraft | null;
  onPlaced: () => void;
  onError: (message: string) => void;
}) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      void (async () => {
        if (!placing) return;

        try {
          await createUnit({
            ...placing,
            lat: e.latlng.lat,
            lon: e.latlng.lng,
          });

          onPlaced();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erreur inconnue pendant la création d'unité";
          onError(message);
        }
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

function RestartScenarioButton({
  onRestart,
  busy,
}: {
  onRestart: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onRestart}
      disabled={busy}
      title="Revenir au début du scénario"
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        zIndex: 1200,
        width: 34,
        height: 34,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(0,0,0,0.45)",
        color: "rgba(255,255,255,0.9)",
        cursor: busy ? "not-allowed" : "pointer",
        fontSize: 15,
        lineHeight: 1,
        opacity: busy ? 0.65 : 0.85,
      }}
    >
      {busy ? "…" : "↻"}
    </button>
  );
}

function ComintAlert({
  open,
  onSeeOnMap,
  onClose,
}: {
  open: boolean;
  onSeeOnMap: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 54,
        bottom: 12,
        zIndex: 1250,
        width: 320,
        padding: 10,
        borderRadius: 10,
        border: "1px solid rgba(255,160,160,0.45)",
        background: "rgba(30, 8, 8, 0.9)",
        color: "#ffdede",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Supicious automated detection : HQ</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onSeeOnMap}
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          see on map
        </button>
        <button
          onClick={onClose}
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.85)",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          close
        </button>
      </div>
    </div>
  );
}

function OrderSentNotice({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 54,
        bottom: 132,
        zIndex: 1250,
        width: 220,
        padding: 10,
        borderRadius: 10,
        border: "1px solid rgba(150,220,160,0.45)",
        background: "rgba(10, 34, 14, 0.9)",
        color: "#ddffe0",
        fontFamily: "system-ui",
      }}
    >
      <button
        onClick={onClose}
        title="Fermer"
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.3)",
          background: "rgba(0,0,0,0.3)",
          color: "white",
          cursor: "pointer",
          lineHeight: 1,
          fontSize: 11,
          padding: 0,
        }}
      >
        ×
      </button>
      <div style={{ fontSize: 13, fontWeight: 700, marginLeft: 24 }}>Ordre envoyé</div>
    </div>
  );
}

function DroneDataAlert({
  open,
  droneName,
  onClose,
  onWatch,
}: {
  open: boolean;
  droneName: string;
  onClose: () => void;
  onWatch: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 54,
        bottom: 172,
        zIndex: 1260,
        width: 340,
        padding: 10,
        borderRadius: 10,
        border: "1px solid rgba(120,200,255,0.45)",
        background: "rgba(8, 18, 30, 0.92)",
        color: "#dff3ff",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Donnée drone {droneName} reçues</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.9)",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          fermer
        </button>
        <button
          onClick={onWatch}
          style={{
            border: "1px solid rgba(120,200,255,0.45)",
            background: "rgba(120,200,255,0.14)",
            color: "#e8f7ff",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          regarder
        </button>
      </div>
    </div>
  );
}

function VideoOverlay({
  title,
  src,
  onClose,
}: {
  title: string;
  src: string;
  onClose: () => void;
}) {
  const [videoError, setVideoError] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(72vw, 980px)",
          maxHeight: "80vh",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(10,12,16,0.98)",
          padding: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        }}
      >
        <button
          onClick={onClose}
          title="Close video"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, margin: "2px 4px 8px 4px" }}>{title}</div>
        <video
          key={src}
          controls
          autoPlay
          muted
          playsInline
          preload="auto"
          src={src}
          onLoadedData={() => setVideoError(null)}
          onError={() => setVideoError("Impossible de lire cette vidéo dans le navigateur.")}
          style={{ width: "100%", height: "auto", maxHeight: "72vh", borderRadius: 8, background: "black" }}
        />
        {videoError && (
          <div style={{ color: "#ffb4b4", fontSize: 12, margin: "8px 4px 0 4px" }}>{videoError}</div>
        )}
      </div>
    </div>
  );
}

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
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>

          <div>
            <label style={label}>Type</label>
            <select
              style={input}
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitDraft["unit_type"])}
            >
              {SURFACE_UNIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {APP6_BY_UNIT_TYPE[t].label}
                </option>
              ))}
              <option disabled>──────────</option>
              {DRONE_UNIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {APP6_BY_UNIT_TYPE[t].label}
                </option>
              ))}
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

function MissionOrderModal({
  draft,
  onClose,
  onChange,
  onSend,
}: {
  draft: MissionOrderDraft | null;
  onClose: () => void;
  onChange: (next: MissionOrderDraft) => void;
  onSend: () => void;
}) {
  if (!draft) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div
        style={{
          ...modal,
          width: "min(92vw, 980px)",
          maxHeight: "88vh",
          overflow: "auto",
          zIndex: 32000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{draft.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>Drone sélectionné : {draft.droneName}</div>
          </div>
          <button style={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div>
            <label style={label}>1. SITUATION</label>
            <textarea
              style={{ ...input, minHeight: 96, resize: "vertical", whiteSpace: "pre-wrap" }}
              value={draft.situation}
              onChange={(e) => onChange({ ...draft, situation: e.target.value })}
            />
          </div>

          <div>
            <label style={label}>2. MISSION</label>
            <textarea
              style={{ ...input, minHeight: 190, resize: "vertical", whiteSpace: "pre-wrap" }}
              value={draft.mission}
              onChange={(e) => onChange({ ...draft, mission: e.target.value })}
            />
          </div>

          <div>
            <label style={label}>3. EXÉCUTION</label>
            <textarea
              style={{ ...input, minHeight: 320, resize: "vertical", whiteSpace: "pre-wrap" }}
              value={draft.execution}
              onChange={(e) => onChange({ ...draft, execution: e.target.value })}
            />
          </div>

          <div>
            <label style={label}>4. SOUTIEN</label>
            <textarea
              style={{ ...input, minHeight: 130, resize: "vertical", whiteSpace: "pre-wrap" }}
              value={draft.soutien}
              onChange={(e) => onChange({ ...draft, soutien: e.target.value })}
            />
          </div>

          <div>
            <label style={label}>5. COMMANDEMENT & TRANSMISSIONS</label>
            <textarea
              style={{ ...input, minHeight: 160, resize: "vertical", whiteSpace: "pre-wrap" }}
              value={draft.commandementTransmissions}
              onChange={(e) => onChange({ ...draft, commandementTransmissions: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button style={secondaryBtn} onClick={onClose}>
            Fermer
          </button>
          <button style={primaryBtn} onClick={onSend}>
            Envoyer
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
  const center: [number, number] = [48.247165, 39.950965];

  // Zoom
  const [zoom, setZoom] = useState<number>(100);

  const [units, setUnits] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatResetToken, setChatResetToken] = useState(0);
  const [scenarioResetting, setScenarioResetting] = useState(false);
  const [scenarioAlertOpen, setScenarioAlertOpen] = useState(false);
  const [scenarioHQFeature, setScenarioHQFeature] = useState<PointFeature<UnitProps> | null>(null);
  const [scenarioHQRevealed, setScenarioHQRevealed] = useState(false);
  const [mapFocusRequest, setMapFocusRequest] = useState<FocusRequest | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [hoveredReconUnitName, setHoveredReconUnitName] = useState<string | null>(null);
  const [videoOverlay, setVideoOverlay] = useState<{ title: string; url: string } | null>(null);
  const [missionOrderDraft, setMissionOrderDraft] = useState<MissionOrderDraft | null>(null);
  const [reconOrderGraphic, setReconOrderGraphic] = useState<ReconOrderGraphic | null>(null);
  const [orderSentNoticeOpen, setOrderSentNoticeOpen] = useState(false);
  const [droneDataAlert, setDroneDataAlert] = useState<{ open: boolean; droneName: string }>({
    open: false,
    droneName: "UAV-REC-001",
  });
  const [externalChatPrompt, setExternalChatPrompt] = useState<ExternalChatPrompt | null>(null);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [placing, setPlacing] = useState<UnitDraft | null>(null);
  const markerRefs = useRef<Record<string, LeafletMarker>>({});
  const bootIdRef = useRef<string | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const initialScenarioScheduledRef = useRef(false);
  const focusSequenceRef = useRef(0);
  const flightTimerRef = useRef<number | null>(null);
  const externalPromptSeqRef = useRef(0);

  const load = useCallback(async (): Promise<FeatureCollection | null> => {
    try {
      const u = await fetchUnits();
      setUnits(u);
      setError(null);
      return u;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
      return null;
    }
  }, []);

  const unitFeatures = useMemo(() => (units?.features ?? []) as Array<PointFeature<UnitProps>>, [units]);
  const visibleUnitFeatures = useMemo(() => {
    if (scenarioHQRevealed) return unitFeatures;
    return unitFeatures.filter((f) => {
      if (scenarioHQFeature && f.properties.id === scenarioHQFeature.properties.id) return false;
      return normalizeUnitName(f.properties.name) !== SCENARIO_HQ.name;
    });
  }, [scenarioHQFeature, scenarioHQRevealed, unitFeatures]);
  const selectedUnit = useMemo(
    () => unitFeatures.find((f) => f.properties.id === selectedUnitId) ?? null,
    [selectedUnitId, unitFeatures]
  );

  const updateUnitPosition = useCallback((unitId: string, lat: number, lon: number) => {
    setUnits((prev) => {
      if (!prev) return prev;
      const nextFeatures = prev.features.map((feature) => {
        const point = feature as PointFeature<UnitProps>;
        if (point.properties.id !== unitId || point.geometry.type !== "Point") return feature;
        return {
          ...point,
          geometry: {
            ...point.geometry,
            coordinates: [lon, lat],
          },
        };
      });
      return { ...prev, features: nextFeatures };
    });
  }, []);

  const stopFlightSimulation = useCallback(() => {
    if (flightTimerRef.current !== null) {
      window.clearInterval(flightTimerRef.current);
      flightTimerRef.current = null;
    }
  }, []);

  const scheduleScenarioAlert = useCallback((collection: FeatureCollection | null) => {
    if (alertTimerRef.current !== null) {
      window.clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }

    setScenarioAlertOpen(false);
    setSelectedUnitId(null);
    setScenarioHQRevealed(false);

    const features = (collection?.features ?? []) as Array<PointFeature<UnitProps>>;
    const hq = findScenarioHQFeature(features);
    setScenarioHQFeature(hq);

    if (!hq) return;

    alertTimerRef.current = window.setTimeout(() => {
      setScenarioHQRevealed(true);
      setScenarioAlertOpen(true);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
      stopFlightSimulation();
    };
  }, [stopFlightSimulation]);

  useEffect(() => {
    void (async () => {
      const loaded = await load();
      if (!initialScenarioScheduledRef.current) {
        initialScenarioScheduledRef.current = true;
        scheduleScenarioAlert(loaded);
      }
    })();
  }, [load, scheduleScenarioAlert, stopFlightSimulation]);

  useEffect(() => {
    let stopped = false;

    const checkHealth = async () => {
      try {
        const status = await fetchHealth();
        if (stopped) return;

        if (bootIdRef.current === null) {
          bootIdRef.current = status.boot_id;
          return;
        }

        if (bootIdRef.current !== status.boot_id) {
          bootIdRef.current = status.boot_id;
          stopFlightSimulation();
          setPlacing(null);
          setUnitModalOpen(false);
          setHoveredReconUnitName(null);
          setMissionOrderDraft(null);
          setReconOrderGraphic(null);
          setOrderSentNoticeOpen(false);
          setDroneDataAlert({ open: false, droneName: "UAV-REC-001" });
          setExternalChatPrompt(null);
          setVideoOverlay(null);
          setChatResetToken((v) => v + 1);
          const loaded = await load();
          if (stopped) return;
          scheduleScenarioAlert(loaded);
        }
      } catch {
        // health polling best-effort
      }
    };

    void checkHealth();
    const intervalId = window.setInterval(() => {
      void checkHealth();
    }, 4000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [load, scheduleScenarioAlert]);

  const handleScenarioRestart = useCallback(() => {
    if (scenarioResetting) return;
    void (async () => {
      setScenarioResetting(true);
      setError(null);
      try {
        await resetScenario();
        stopFlightSimulation();
        setPlacing(null);
        setUnitModalOpen(false);
        setHoveredReconUnitName(null);
        setMissionOrderDraft(null);
        setReconOrderGraphic(null);
        setOrderSentNoticeOpen(false);
        setDroneDataAlert({ open: false, droneName: "UAV-REC-001" });
        setExternalChatPrompt(null);
        setVideoOverlay(null);
        setChatResetToken((v) => v + 1);
        const loaded = await load();
        scheduleScenarioAlert(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur reset scénario");
      } finally {
        setScenarioResetting(false);
      }
    })();
  }, [load, scenarioResetting, scheduleScenarioAlert, stopFlightSimulation]);

  const handleSeeOnMap = useCallback(() => {
    if (!scenarioHQFeature) {
      setScenarioAlertOpen(false);
      return;
    }

    setScenarioHQRevealed(true);
    const [lon, lat] = scenarioHQFeature.geometry.coordinates;
    setSelectedUnitId(scenarioHQFeature.properties.id);
    focusSequenceRef.current += 1;
    setMapFocusRequest({ key: focusSequenceRef.current, lat, lon });
    setScenarioAlertOpen(false);
  }, [scenarioHQFeature]);

  const handleChatLinkClick = useCallback((url: string, label?: string) => {
    const reconUnitName = reconUnitNameFromLink(url);
    if (reconUnitName) {
      const target = unitFeatures.find(
        (f) => f.properties.unit_type === "UAS_RECON" && normalizeUnitName(f.properties.name) === reconUnitName
      );

      if (!target) {
        setError(`Drone ${reconUnitName} introuvable sur la carte.`);
        return;
      }

      const [lon, lat] = target.geometry.coordinates;
      setError(null);
      setSelectedUnitId(target.properties.id);
      focusSequenceRef.current += 1;
      setMapFocusRequest({ key: focusSequenceRef.current, lat, lon });
      return;
    }

    const resolved = url.startsWith("http://") || url.startsWith("https://") ? url : `${API_BASE}${url}`;
    const lower = resolved.toLowerCase();
    if (lower.endsWith(".mkv") || lower.includes("/media/")) {
      const title = label && label.trim() ? label.trim() : resolved.split("/").pop() ?? "video";
      setVideoOverlay({ title, url: resolved });
      return;
    }
    window.open(resolved, "_blank", "noopener,noreferrer");
  }, [unitFeatures]);

  const handleChatLinkHover = useCallback((url: string, isHovering: boolean) => {
    const reconUnitName = reconUnitNameFromLink(url);
    if (!reconUnitName) return;
    setHoveredReconUnitName(isHovering ? reconUnitName : null);
  }, []);

  const handleChatActions = useCallback(
    (actions: ChatAction[]) => {
      for (const action of actions) {
        if (action.type === "confirm_hq_enemy") {
          const payload = action.payload ?? {};
          const targetName = normalizeUnitName(payloadString(payload, "name", SCENARIO_HQ.name));
          const hq = unitFeatures.find((f) => normalizeUnitName(f.properties.name) === targetName);
          if (!hq) {
            setError(`Unité ${targetName} introuvable pour confirmation ENEMY.`);
            continue;
          }

          const enemySidc = sidcFor({
            name: hq.properties.name,
            side: "ENEMY",
            unit_type: hq.properties.unit_type,
            echelon: hq.properties.echelon ?? "SECTION",
            sidc: hq.properties.sidc ?? "",
          });

          void (async () => {
            try {
              await updateUnit(hq.properties.id, { side: "ENEMY", sidc: enemySidc });
              const loaded = await load();
              const features = (loaded?.features ?? []) as Array<PointFeature<UnitProps>>;
              setScenarioHQFeature(findScenarioHQFeature(features));
              if (selectedUnitId === hq.properties.id) {
                setSelectedUnitId(null);
              }
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur confirmation HQ ennemi");
            }
          })();
          continue;
        }

        if (action.type !== "draft_recon_order") continue;

        if (!selectedUnit || selectedUnit.properties.unit_type !== "UAS_RECON") {
          setError("Sélectionne un drone UAS - Recon sur la carte avant de générer un ordre.");
          continue;
        }

        const payload = action.payload ?? {};
        setMissionOrderDraft({
          title: payloadString(payload, "title", "ORDRE DE MISSION – DRONE DE RECONNAISSANCE"),
          situation: payloadString(payload, "situation", ""),
          mission: payloadString(payload, "mission", ""),
          execution: payloadString(payload, "execution", ""),
          soutien: payloadString(payload, "soutien", ""),
          commandementTransmissions: payloadString(payload, "commandement_transmissions", ""),
          droneId: selectedUnit.properties.id,
          droneName: selectedUnit.properties.name,
        });
        setError(null);
      }
    },
    [load, selectedUnit, selectedUnitId, unitFeatures]
  );

  const handleSendMissionOrder = useCallback(() => {
    if (!missionOrderDraft) return;

    const drone = unitFeatures.find(
      (f) => f.properties.id === missionOrderDraft.droneId && f.properties.unit_type === "UAS_RECON"
    );
    if (!drone) {
      setError("Drone de reconnaissance sélectionné introuvable.");
      return;
    }

    const hq = scenarioHQFeature ?? findScenarioHQFeature(unitFeatures);
    if (!hq) {
      setError("Poste de commandement cible introuvable sur la carte.");
      return;
    }

    const [droneLon, droneLat] = drone.geometry.coordinates;
    const [hqLon, hqLat] = hq.geometry.coordinates;
    const start: [number, number] = [droneLat, droneLon];
    const target: [number, number] = [hqLat, hqLon];

    stopFlightSimulation();
    markerRefs.current[drone.properties.id]?.closePopup();
    if (selectedUnitId) {
      markerRefs.current[selectedUnitId]?.closePopup();
    }

    setReconOrderGraphic({
      droneId: drone.properties.id,
      droneName: drone.properties.name,
      from: start,
      to: target,
    });
    setMissionOrderDraft(null);
    setOrderSentNoticeOpen(true);
    setSelectedUnitId(null);
    setDroneDataAlert({ open: false, droneName: drone.properties.name });
    setError(null);

    const tickMs = 120;
    const approachSpeedMps = 220;
    const orbitRadiusM = 800;
    const orbitDurationMs = 5000;
    const orbitAngularSpeed = (Math.PI * 2) / (orbitDurationMs / 1000);

    let currentPos: [number, number] = start;
    let stage: "approach" | "orbit" = "approach";
    let orbitStartTs = 0;
    let orbitStartAngle = bearingRadians(target, start);
    let orbitAlertSent = false;

    flightTimerRef.current = window.setInterval(() => {
      if (stage === "approach") {
        const distToTarget = haversineMeters(currentPos, target);
        if (distToTarget <= orbitRadiusM) {
          stage = "orbit";
          orbitStartTs = Date.now();
          orbitStartAngle = bearingRadians(target, currentPos);
        } else {
          const allowed = Math.max(0, distToTarget - orbitRadiusM);
          const step = Math.min((approachSpeedMps * tickMs) / 1000, allowed);
          currentPos = moveTowards(currentPos, target, step);
          updateUnitPosition(drone.properties.id, currentPos[0], currentPos[1]);
          setReconOrderGraphic((prev) =>
            prev && prev.droneId === drone.properties.id ? { ...prev, from: currentPos } : prev
          );
          return;
        }
      }

      if (stage === "orbit") {
        const elapsedMs = Date.now() - orbitStartTs;
        if (!orbitAlertSent && elapsedMs >= orbitDurationMs) {
          orbitAlertSent = true;
          setDroneDataAlert({ open: true, droneName: drone.properties.name });
        }
        const angle = orbitStartAngle + orbitAngularSpeed * (elapsedMs / 1000);
        currentPos = destinationPoint(target, orbitRadiusM, angle);
        updateUnitPosition(drone.properties.id, currentPos[0], currentPos[1]);
        setReconOrderGraphic((prev) =>
          prev && prev.droneId === drone.properties.id ? { ...prev, from: currentPos } : prev
        );
      }
    }, tickMs);
  }, [missionOrderDraft, scenarioHQFeature, selectedUnitId, stopFlightSimulation, unitFeatures, updateUnitPosition]);

  const triggerExternalChatPrompt = useCallback((content: string) => {
    externalPromptSeqRef.current += 1;
    setExternalChatPrompt({ key: externalPromptSeqRef.current, content });
  }, []);

  const handleWatchDroneData = useCallback(() => {
    const droneName = droneDataAlert.droneName || "UAV-REC-001";
    setDroneDataAlert((prev) => ({ ...prev, open: false }));
    triggerExternalChatPrompt(`Regarder nouvelle donnée ${droneName}`);
  }, [droneDataAlert.droneName, triggerExternalChatPrompt]);

  const handleUnitRightClickDelete = useCallback(
    async (unitId: string, unitName: string) => {
      const shouldDelete = window.confirm(`Supprimer l'unite "${unitName}" ?`);
      if (!shouldDelete) return;

      try {
        await deleteUnit(unitId);
        if (selectedUnitId === unitId) {
          setSelectedUnitId(null);
        }
        if (reconOrderGraphic?.droneId === unitId) {
          setReconOrderGraphic(null);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur suppression unite");
      }
    },
    [load, reconOrderGraphic?.droneId, selectedUnitId]
  );

  useEffect(() => {
    if (!selectedUnitId) return;
    const marker = markerRefs.current[selectedUnitId];
    if (marker) marker.openPopup();
  }, [selectedUnitId, visibleUnitFeatures]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      {/* LEFT: Chat */}
      <div
        style={{
          width: 570,
          borderRight: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "rgba(12,14,18,0.95)",
        }}
      >
        <ChatPanel
          resetToken={chatResetToken}
          onLinkClick={handleChatLinkClick}
          onLinkHover={handleChatLinkHover}
          externalPrompt={externalChatPrompt}
          onActions={handleChatActions}
        />
      </div>

      {/* RIGHT: Map + overlays */}
      <div style={{ flex: 1, position: "relative" }}>
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

          {/* Watch zoom level to adjust unit icon sizes */}
          <ZoomWatcher onZoom={setZoom} />
          <MapFocusController request={mapFocusRequest} />

          <MapClickHandler
            placing={placing}
            onPlaced={() => {
              setPlacing(null);
              void load();
            }}
            onError={setError}
          />

          {/* Units */}
          {visibleUnitFeatures.map((f) => {
            const [lon, lat] = f.geometry.coordinates;
            const fallbackSidc = sidcFor({
              name: f.properties.name,
              side: f.properties.side,
              unit_type: f.properties.unit_type,
              echelon: f.properties.echelon ?? "SECTION",
              sidc: "",
            });
            const sidc = f.properties.sidc && new ms.Symbol(f.properties.sidc).isValid() ? f.properties.sidc : fallbackSidc;
            const isReconHighlighted =
              hoveredReconUnitName !== null &&
              f.properties.unit_type === "UAS_RECON" &&
              normalizeUnitName(f.properties.name) === hoveredReconUnitName;
            const icon = makeApp6Icon(sidc, zoom, isReconHighlighted);

            return (
              <Marker
                key={f.properties.id}
                position={[lat, lon]}
                icon={icon}
                zIndexOffset={isReconHighlighted ? 1000 : 0}
                eventHandlers={{
                  click: () => {
                    if (reconOrderGraphic?.droneId === f.properties.id) return;
                    setSelectedUnitId(f.properties.id);
                  },
                  contextmenu: (e) => {
                    if (e.originalEvent) {
                      L.DomEvent.preventDefault(e.originalEvent);
                    }
                    void handleUnitRightClickDelete(f.properties.id, f.properties.name);
                  },
                }}
                ref={(marker) => {
                  if (marker) {
                    markerRefs.current[f.properties.id] = marker;
                  } else {
                    delete markerRefs.current[f.properties.id];
                  }
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "system-ui" }}>
                    <div style={{ fontWeight: 700 }}>{f.properties.name}</div>
                    <div>Side: {f.properties.side}</div>
                    <div>Type: {APP6_BY_UNIT_TYPE[f.properties.unit_type].label}</div>
                    {f.properties.echelon && <div>Echelon: {f.properties.echelon}</div>}
                    <div>SIDC: {sidc}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {reconOrderGraphic && (
            <>
              <Polyline
                positions={[reconOrderGraphic.from, reconOrderGraphic.to]}
                pathOptions={{
                  color: "#76c7ff",
                  weight: 3,
                  opacity: 0.95,
                  dashArray: "10 8",
                }}
              >
                <Tooltip
                  permanent
                  direction="center"
                  offset={[0, -4]}
                  className="app6-order-label"
                >
                  ORDRE APP6 RECO
                </Tooltip>
              </Polyline>
            </>
          )}
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

        <RestartScenarioButton onRestart={handleScenarioRestart} busy={scenarioResetting} />
        <ComintAlert
          open={scenarioAlertOpen}
          onSeeOnMap={handleSeeOnMap}
          onClose={() => setScenarioAlertOpen(false)}
        />
        <OrderSentNotice open={orderSentNoticeOpen} onClose={() => setOrderSentNoticeOpen(false)} />
        <DroneDataAlert
          open={droneDataAlert.open}
          droneName={droneDataAlert.droneName}
          onClose={() => setDroneDataAlert((prev) => ({ ...prev, open: false }))}
          onWatch={handleWatchDroneData}
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
          {scenarioResetting && <div style={{ fontSize: 12, marginTop: 4 }}>Reset scénario en cours…</div>}
          <div style={{ fontSize: 12, marginTop: 6 }}>Units: {visibleUnitFeatures.length}</div>
          {error && <div style={{ marginTop: 6, color: "#ffb4b4" }}>{error}</div>}
        </div>

        <style>{`
          .app6-marker { background: transparent; border: none; }
          .app6-marker svg { display:block; }
          .app6-marker-highlighted svg {
            filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.95)) drop-shadow(0 0 14px rgba(255, 215, 0, 0.7));
            transform: scale(1.08);
          }
          .app6-order-label {
            background: rgba(8, 25, 40, 0.82);
            color: #bfe7ff;
            border: 1px solid rgba(118, 199, 255, 0.45);
            border-radius: 6px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.35);
          }
          .leaflet-container { z-index: 0; }
        `}</style>
      </div>

      {videoOverlay && (
        <VideoOverlay title={videoOverlay.title} src={videoOverlay.url} onClose={() => setVideoOverlay(null)} />
      )}
      <MissionOrderModal
        draft={missionOrderDraft}
        onClose={() => setMissionOrderDraft(null)}
        onChange={setMissionOrderDraft}
        onSend={handleSendMissionOrder}
      />
    </div>
  );
}

function iconSizeForZoom(zoom: number): number {
  const min = 8; // très petit au dézoom
  const max = 48;

  const zMin = 4;
  const zMax = 16;

  const clamped = Math.max(zMin, Math.min(zMax, zoom));
  let t = (clamped - zMin) / (zMax - zMin);

  // Non-linéaire : shrink plus agressif quand t est bas
  t = Math.pow(t, 1.7);

  return Math.round(min + t * (max - min));
}
