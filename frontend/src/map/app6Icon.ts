import ms from "milsymbol";
import L from "leaflet";

export function makeApp6Icon(sidc: string) {
  const sym = new ms.Symbol(sidc, {
    size: 38,
    frame: true,
  });

  const svg = sym.asSVG();
  return L.divIcon({
    className: "app6-marker",
    html: svg,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}
