import "leaflet/dist/leaflet.css";
import L from "leaflet";
import ms from "milsymbol";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeafletMouseEvent, Marker as LeafletMarker } from "leaflet";
import type { FeatureCollection } from "./api";
import { createUnit, fetchHealth, fetchUnits, resetScenario } from "./api";
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
  side: "UNKNOWN" as const,
  unit_type: "COMMAND_POST" as const,
  echelon: "BRIGADE" as const,
  lat: 48.247165,
  lon: 39.950965,
};

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
  const tolerance = 1e-6;
  return (
    features.find((f) => {
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
  const [mapFocusRequest, setMapFocusRequest] = useState<FocusRequest | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [placing, setPlacing] = useState<UnitDraft | null>(null);
  const markerRefs = useRef<Record<string, LeafletMarker>>({});
  const bootIdRef = useRef<string | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const initialScenarioScheduledRef = useRef(false);
  const focusSequenceRef = useRef(0);

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

  const scheduleScenarioAlert = useCallback((collection: FeatureCollection | null) => {
    if (alertTimerRef.current !== null) {
      window.clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }

    setScenarioAlertOpen(false);
    setSelectedUnitId(null);

    const features = (collection?.features ?? []) as Array<PointFeature<UnitProps>>;
    const hq = findScenarioHQFeature(features);
    setScenarioHQFeature(hq);

    if (!hq) return;

    alertTimerRef.current = window.setTimeout(() => {
      setScenarioAlertOpen(true);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded = await load();
      if (!initialScenarioScheduledRef.current) {
        initialScenarioScheduledRef.current = true;
        scheduleScenarioAlert(loaded);
      }
    })();
  }, [load, scheduleScenarioAlert]);

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
          setPlacing(null);
          setUnitModalOpen(false);
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
        setPlacing(null);
        setUnitModalOpen(false);
        setChatResetToken((v) => v + 1);
        const loaded = await load();
        scheduleScenarioAlert(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur reset scénario");
      } finally {
        setScenarioResetting(false);
      }
    })();
  }, [load, scenarioResetting, scheduleScenarioAlert]);

  const handleSeeOnMap = useCallback(() => {
    if (!scenarioHQFeature) {
      setScenarioAlertOpen(false);
      return;
    }

    const [lon, lat] = scenarioHQFeature.geometry.coordinates;
    setSelectedUnitId(scenarioHQFeature.properties.id);
    focusSequenceRef.current += 1;
    setMapFocusRequest({ key: focusSequenceRef.current, lat, lon });
    setScenarioAlertOpen(false);
  }, [scenarioHQFeature]);

  const unitFeatures = useMemo(() => (units?.features ?? []) as Array<PointFeature<UnitProps>>, [units]);

  useEffect(() => {
    if (!selectedUnitId) return;
    const marker = markerRefs.current[selectedUnitId];
    if (marker) marker.openPopup();
  }, [selectedUnitId, unitFeatures]);

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
          onActions={(actions) => {
            // Pour l’instant on log ; ensuite on dispatchera vers createUnit/load/etc.
            console.log("Chat actions:", actions);
          }}
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
          {unitFeatures.map((f) => {
            const [lon, lat] = f.geometry.coordinates;
            const fallbackSidc = sidcFor({
              name: f.properties.name,
              side: f.properties.side,
              unit_type: f.properties.unit_type,
              echelon: f.properties.echelon ?? "SECTION",
              sidc: "",
            });
            const sidc = f.properties.sidc && new ms.Symbol(f.properties.sidc).isValid() ? f.properties.sidc : fallbackSidc;
            const icon = makeApp6Icon(sidc, zoom);

            return (
              <Marker
                key={f.properties.id}
                position={[lat, lon]}
                icon={icon}
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
          <div style={{ fontSize: 12, marginTop: 6 }}>Units: {unitFeatures.length}</div>
          {error && <div style={{ marginTop: 6, color: "#ffb4b4" }}>{error}</div>}
        </div>

        <style>{`
          .app6-marker { background: transparent; border: none; }
          .app6-marker svg { display:block; }
          .leaflet-container { z-index: 0; }
        `}</style>
      </div>
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
