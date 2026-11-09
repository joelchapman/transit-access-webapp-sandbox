import { mapColors, MTA_LINE_COLOR_SUBSTITUTIONS } from "./mapColors";
import { dotView } from "@/components/MtaMap/layers/CurrentOutages/currentOutagesProps";

// A muted base map in the spirit of Apple Maps' transit view, applied on top of the Mapbox Studio
// export (mapbox-studio-style.json) when the map is created. The export stays untouched, so it can
// be re-exported from Studio at any time and these customizations still apply.
//
// The subway is the subject: everything underneath is desaturated and low-contrast (roads, highways
// included, are plain gray-on-white) so the official line colors are the only saturated thing on screen.
// Every app-specific layer (stations, elevators, connectors) keeps its own styling.
//
// Every color here lives in mapColors.ts, not inline — same reason as that file's marker colors:
// Mapbox paint properties can't resolve CSS variables or parse oklch, so they can't read globals.css.

type Layer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown>; [k: string]: unknown };
type Style = { layers: Layer[]; [k: string]: unknown };

// Line weights by zoom: thin, crisp strokes like a transit diagram, never heavier than the streets they follow
const SUBWAY_WIDTH = ["interpolate", ["linear"], ["zoom"], 10, 1.5, 12, 2.25, 14, 3, 18, 3.75];
const SUBWAY_CASING_WIDTH = ["interpolate", ["linear"], ["zoom"], 10, 2.5, 12, 3.5, 14, 4.5, 18, 5.5];

// A few corridors (Queens Blvd, 8th/6th Av, Lexington/7th Av in Brooklyn) carry several subway lines
// on tracks only ~17m apart — too close to read as separate colors once you're zoomed out. So each
// group of lines sharing a track gets nudged sideways into its own lane, on whichever side it
// actually runs, and that nudge fades out by zoom 14, where the real track geometry already
// spreads them apart enough to speak for itself.
const LINE_OVERLAP_SHIFT = [
  "match", ["slice", ["get", "name"], 0, 1],
  ["N", "Q", "R", "W", "S"], -1,
  ["1", "2", "3"], -0.5,
  ["4", "5", "6"], 0.5,
  ["B", "D", "F", "M", "J", "Z", "G"], 1,
  0,
];
const SUBWAY_OFFSET = [
  "interpolate", ["linear"], ["zoom"],
  10, ["*", LINE_OVERLAP_SHIFT, 2.5],
  12, ["*", LINE_OVERLAP_SHIFT, 3.25],
  13, ["*", LINE_OVERLAP_SHIFT, 3.6],
  14, 0,
];

// Zoomed out, streets are white lines; at street zoom they become gray pavement between white sidewalks
const STREET_FROM = 15;
const STREET_TO = 16.5;
const byZoom = (far: string, near: string) => ["interpolate", ["linear"], ["zoom"], STREET_FROM, far, STREET_TO, near];

// Shops, offices and hotels read tan; homes and everything else stay gray
const COMMERCIAL = ["commercial", "retail", "office", "hotel", "industrial", "warehouse", "supermarket"];

export function applyMapCustomization<T>(source: T): T {
  const style: Style = JSON.parse(JSON.stringify(source));
  const byId = new Map(style.layers.map((l) => [l.id, l]));
  const paint = (id: string, values: Record<string, unknown>) => {
    const layer = byId.get(id);
    if (layer) layer.paint = { ...layer.paint, ...values };
  };
  const layout = (id: string, values: Record<string, unknown>) => {
    const layer = byId.get(id);
    if (layer) layer.layout = { ...layer.layout, ...values };
  };
  const insertBefore = (beforeId: string, layer: Layer) => {
    const i = style.layers.findIndex((l) => l.id === beforeId);
    if (i >= 0 && !byId.has(layer.id)) style.layers.splice(i, 0, layer);
  };

  // Land, parks, water
  const landRamp = ["interpolate", ["linear"], ["zoom"], 9, mapColors.landLow, 11, mapColors.land, STREET_FROM, mapColors.land, STREET_TO, mapColors.landStreet];
  paint("land", { "background-color": landRamp });
  paint("land-structure-polygon", { "fill-color": landRamp });
  paint("land-structure-line", { "line-color": landRamp });
  paint("landuse", {
    "fill-color": ["match", ["get", "class"], ["park", "grass", "wood", "scrub", "pitch", "agriculture"], mapColors.park, mapColors.land],
  });
  paint("national-park", { "fill-color": mapColors.park });
  paint("water", { "fill-color": mapColors.water });
  paint("waterway", { "line-color": mapColors.water });

  // Roads: white with a light gray edge, turning into gray pavement and white sidewalks up close.
  // Highways get no color of their own; they're not the subject
  for (const layer of style.layers) {
    const { id } = layer;
    if (layer.type !== "line" || !/^(road|bridge|tunnel)-/.test(id)) continue;
    const isCase = id.includes("-case");
    const isRoad = /navigation$/.test(id) && !/arrow/.test(id);
    if (id.startsWith("tunnel-") && !isCase && id.includes("navigation")) {
      paint(id, { "line-color": mapColors.tunnel });
    } else if (isCase) {
      const edge = /primary|secondary|motorway-trunk|major-link/.test(id) ? mapColors.majorCase : mapColors.roadCase;
      paint(id, { "line-color": byZoom(edge, mapColors.sidewalk) });
    } else if (isRoad) {
      paint(id, { "line-color": byZoom(mapColors.surface, mapColors.pavement) });
    }
  }

  // Building footprints from street zoom, under the existing 3D extrusions
  insertBefore("building-extrusion", {
    id: "theme-building-footprint",
    type: "fill",
    source: "composite",
    "source-layer": "building",
    minzoom: 15,
    // underground arrives as "true"/"false" strings; anything not marked underground is drawn
    filter: ["!=", ["to-string", ["get", "underground"]], "true"],
    paint: {
      "fill-color": ["match", ["get", "type"], COMMERCIAL, mapColors.buildingCommercial, mapColors.building],
      "fill-outline-color": ["match", ["get", "type"], COMMERCIAL, mapColors.buildingCommercialEdge, mapColors.buildingEdge],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.5, 1],
    },
  });
  paint("building-extrusion", {
    "fill-extrusion-color": ["match", ["get", "type"], COMMERCIAL, mapColors.buildingCommercial, mapColors.buildingExtrusion],
  });

  // Station platforms and passages underground: translucent red footprints over the street grid
  paint("building-underground", {
    "fill-color": mapColors.platform,
    "fill-outline-color": mapColors.platformEdge,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 0.45],
  });
  paint("tunnel-path", { "line-color": mapColors.platformEdge });

  // Labels: all at least 7:1 on the surfaces they sit on. One gray family, white halos, upright POI names, blue water and green park names
  // Street names small, uppercase and letterspaced, so they read as annotation under the lines
  paint("road-label-navigation", { "text-color": mapColors.label, "text-halo-color": mapColors.surface, "text-halo-width": 1.25 });
  layout("road-label-navigation", {
    "text-transform": "uppercase",
    "text-letter-spacing": 0.06,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 8, 16, 9.5, 18, 11],
  });
  paint("poi-label", { "text-color": mapColors.labelSoft, "text-halo-width": 1, "text-halo-blur": 0 });
  layout("poi-label", { "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] });
  paint("settlement-subdivision-label", { "text-color": mapColors.labelSoft });
  for (const id of ["water-point-label", "water-line-label", "waterway-label"]) {
    paint(id, { "text-color": mapColors.waterLabel, "text-halo-color": "rgba(255, 255, 255, 0.7)" });
  }
  for (const id of ["natural-point-label", "natural-line-label"]) {
    paint(id, { "text-color": mapColors.parkLabel });
  }

  // Subway lines: official colors, solid, with a white casing so parallel and crossing lines separate.
  // Skips recoloring bullets because they're redrawn elsewhere
  for (const layer of style.layers) {
    if (!layer.id.startsWith("mta-") || /^mta-(subwaylines-labels|sir-lines-label)/.test(layer.id)) continue;
    let json = JSON.stringify(layer);
    for (const [from, to] of Object.entries(MTA_LINE_COLOR_SUBSTITUTIONS)) json = json.split(from).join(to);
    Object.assign(layer, JSON.parse(json));
  }
  const lines = byId.get("mta-subwaylines-all");
  if (lines) {
    paint("mta-subwaylines-all", { "line-width": SUBWAY_WIDTH, "line-opacity": 1, "line-offset": SUBWAY_OFFSET });
    insertBefore("mta-subwaylines-all", {
      ...JSON.parse(JSON.stringify(lines)),
      id: "theme-subwaylines-casing",
      paint: {
        "line-color": mapColors.surface,
        "line-width": SUBWAY_CASING_WIDTH,
        "line-opacity": 1,
        "line-offset": SUBWAY_OFFSET,
      },
    });
  }
  paint("mta-sir-lines", { "line-width": SUBWAY_WIDTH, "line-opacity": 1 });

  // Line bullets along the tracks are placed by the app (components/MtaMap/trackBullets.ts) so each
  // bullet can stay upright while a group runs along the line; hide the export's rotated versions
  for (const layer of style.layers) {
    if (/^mta-(subwaylines-labels|sir-lines-label)/.test(layer.id)) layout(layer.id, { visibility: "none" });
  }

  // Stations: the app's stationOutages layer draws one access marker per accessible station
  // (components/StationMarker). These export layers keep the names and tap targets, and drop the
  // wheelchair tile and red X they used to draw. Names come in at street-grid zoom, Apple style.
  layout("mta-subway-stations-accessible", {
    "icon-image": "",
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.5, 15, 12],
    // Fixed to the right of the marker: a complex's stations share a spot and a name, and a fixed
    // anchor lets the duplicates collide away instead of each finding its own space
    "text-anchor": "left",
    "text-radial-offset": 1.9, // clears the status badge on the marker's top right
  });
  paint("mta-subway-stations-accessible", {
    "text-color": mapColors.ink,
    "text-halo-color": mapColors.surface,
    "text-halo-width": 1.5,
    "text-halo-blur": 0.5,
    // Hidden below dotView — the station itself is just a dot there, a name next to it reads oddly
    "text-opacity": ["step", ["zoom"], 0, dotView, 1, 15, 0],
  });
  // No step-free access: a small gray dot and a quieter name. Red stays reserved for outages
  layout("mta-subway-stations-inaccessible", {
    "icon-image": "station-marker-none",
    "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.75, 15, 1],
    "icon-anchor": "center",
    "text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 16, 10.5],
    "text-font": ["Montserrat Medium", "Arial Unicode MS Regular"],
    "text-radial-offset": 0.6,
  });
  paint("mta-subway-stations-inaccessible", {
    "text-color": mapColors.label,
    // Matches the accessible labels' own threshold: hidden below dotView, same reasoning
    "text-opacity": ["step", ["zoom"], 0, dotView+1, 1],
  });

  // Street elevators: the app's "outages" layer draws one marker per elevator (components/ElevatorMarker).
  // This export layer keeps the "Street Elevator" labels and tap target, and keeps its icon only for ramps
  const isRamp = ["==", ["slice", ["downcase", ["get", "elevatorno"]], 0, 2], "ra"];
  layout("transit-elevators", { "icon-image": ["case", isRamp, "ramp", ""] });
  paint("transit-elevators", { "text-color": mapColors.label, "text-halo-color": mapColors.surface, "text-halo-width": 1.25 });

  return style as T;
}

