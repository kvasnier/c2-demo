import L from "leaflet";

export function makeFallbackIcon(label: string) {
  const html = `<div style="padding:6px 8px;border-radius:10px;background:rgba(0,0,0,0.65);color:#fff;font-size:12px;white-space:nowrap;">
    ${label}
  </div>`;
  return L.divIcon({ html, className: "", iconAnchor: [10, 10] });
}
