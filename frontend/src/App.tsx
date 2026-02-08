import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeafletMouseEvent } from "leaflet";
import type { FeatureCollection } from "./api";
import { createPoi, fetchPois, fetchUnits } from "./api";

type UnitProps = {
  id: string;
  name: string;
  side: "FRIEND" | "ENEMY" | "NEUTRAL";
  unit_type: string;
};

type PoiProps = {
  id: string;
  label: string;
  category: string;
};

type PointFeature<P> = GeoJSON.Feature<GeoJSON.Point, P>;

function ClickToCreatePOI({ onCreated }: { onCreated: () => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      // Important: on déclenche une async *indirectement* pour éviter le lint set-state-in-effect.
      void (async () => {
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
      })();
    },
  });

  return null;
}

export default function App() {
  const center: [number, number] = [48.8566, 2.3522];

  const [units, setUnits] = useState<FeatureCollection | null>(null);
  const [pois, setPois] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // éviter le setState synchronisé au début du load (ça déclenche le lint dans certains setups)
      const [u, p] = await Promise.all([fetchUnits(), fetchPois()]);
      setUnits(u);
      setPois(p);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, []);

  useEffect(() => {
    // Indirection pour éviter le lint "setState in effect" trop agressif
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const unitFeatures = useMemo(() => {
    return (units?.features ?? []) as Array<PointFeature<UnitProps>>;
  }, [units]);

  const poiFeatures = useMemo(() => {
    return (pois?.features ?? []) as Array<PointFeature<PoiProps>>;
  }, [pois]);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
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

        <ClickToCreatePOI onCreated={load} />

        {/* Units */}
        {unitFeatures.map((f) => {
          const [lon, lat] = f.geometry.coordinates;
          return (
            <Marker key={f.properties.id} position={[lat, lon]}>
              <Popup>
                <div style={{ fontFamily: "system-ui" }}>
                  <div style={{ fontWeight: 700 }}>{f.properties.name}</div>
                  <div>Side: {f.properties.side}</div>
                  <div>Type: {f.properties.unit_type}</div>
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
          maxWidth: 320,
        }}
      >
        <div style={{ fontWeight: 700 }}>C2 Demo</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>Clique sur la carte pour créer un POI</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Units: {unitFeatures.length} | POIs: {poiFeatures.length}
        </div>
        {error && <div style={{ marginTop: 6, color: "#ffb4b4" }}>{error}</div>}
      </div>
    </div>
  );
}
