// A muted base map in the spirit of Apple Maps' transit view, applied on top of the Mapbox Studio
// export (mapbox-style.json) when the map is created. The export stays untouched, so it can be
// re-exported from Studio at any time and this theme still applies.
//
// The subway is the subject: everything underneath is desaturated and low-contrast (roads, highways
// included, are plain gray-on-white) so the official line colors are the only saturated thing on screen.
// Every app-specific layer (stations, elevators, connectors) keeps its own styling.

type Layer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown>; [k: string]: unknown };
type Style = { layers: Layer[]; [k: string]: unknown };

const C = {
  land: "#F3F2EF",
  landLow: "#F6F5F3",
  landStreet: "#F5F2EA",
  park: "#DDEBD5",
  water: "#B7DCF4",
  waterLabel: "#6E9CC2",
  parkLabel: "#7A9A6B",
  road: "#FFFFFF",
  roadCase: "#E5E3DF",
  majorCase: "#DDDAD5",
  pavement: "#DCDDDF",
  sidewalk: "#FAFAF8",
  tunnel: "#EEEDEA",
  building: "#E8E7E4",
  buildingEdge: "#DAD8D4",
  buildingCommercial: "#F1E3C1",
  buildingCommercialEdge: "#E3D2A9",
  buildingExtrusion: "#F0EFEC",
  platform: "#F2A3A3",
  platformEdge: "#E48686",
  label: "#7D7B77",
  labelSoft: "#9A9893",
};

// Official MTA line colors, replacing the Studio style's approximations
const LINE_COLORS: Record<string, string> = {
  "hsl(219, 100%, 33%)": "#0039A6", // A C E
  "hsl(2, 85%, 56%)": "#EE352E", // 1 2 3
  "hsl(144, 100%, 29%)": "#00933C", // 4 5 6
  "hsl(19, 100%, 55%)": "#FF6319", // B D F M
  "#fdcc08": "#FCCC0A", // N Q R W
  "hsl(305, 57%, 46%)": "#B933AD", // 7
  "hsl(30, 50%, 40%)": "#996633", // J Z
  "hsl(101, 48%, 51%)": "#6CBE45", // G
  "hsl(220, 1%, 51%)": "#808183", // S
  "hsl(216, 3%, 66%)": "#A7A9AC", // L
};

// Line weights by zoom: thin, crisp strokes like a transit diagram, never heavier than the streets they follow
const SUBWAY_WIDTH = ["interpolate", ["linear"], ["zoom"], 10, 1.5, 12, 2.25, 14, 3, 18, 3.75];
const SUBWAY_CASING_WIDTH = ["interpolate", ["linear"], ["zoom"], 10, 2.5, 12, 3.5, 14, 4.5, 18, 5.5];

// Zoomed out, streets are white lines; at street zoom they become gray pavement between white sidewalks
const STREET_FROM = 15;
const STREET_TO = 16.5;
const byZoom = (far: string, near: string) => ["interpolate", ["linear"], ["zoom"], STREET_FROM, far, STREET_TO, near];

// Shops, offices and hotels read tan; homes and everything else stay gray
const COMMERCIAL = ["commercial", "retail", "office", "hotel", "industrial", "warehouse", "supermarket"];

export function applyMapTheme<T>(source: T): T {
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
  const landRamp = ["interpolate", ["linear"], ["zoom"], 9, C.landLow, 11, C.land, STREET_FROM, C.land, STREET_TO, C.landStreet];
  paint("land", { "background-color": landRamp });
  paint("land-structure-polygon", { "fill-color": landRamp });
  paint("land-structure-line", { "line-color": landRamp });
  paint("landuse", {
    "fill-color": ["match", ["get", "class"], ["park", "grass", "wood", "scrub", "pitch", "agriculture"], C.park, C.land],
  });
  paint("national-park", { "fill-color": C.park });
  paint("water", { "fill-color": C.water });
  paint("waterway", { "line-color": C.water });

  // Roads: white with a light gray edge, turning into gray pavement and white sidewalks up close.
  // Highways get no color of their own; they're not the subject
  for (const layer of style.layers) {
    const { id } = layer;
    if (layer.type !== "line" || !/^(road|bridge|tunnel)-/.test(id)) continue;
    const isCase = id.includes("-case");
    const isRoad = /navigation$/.test(id) && !/arrow/.test(id);
    if (id.startsWith("tunnel-") && !isCase && id.includes("navigation")) {
      paint(id, { "line-color": C.tunnel });
    } else if (isCase) {
      const edge = /primary|secondary|motorway-trunk|major-link/.test(id) ? C.majorCase : C.roadCase;
      paint(id, { "line-color": byZoom(edge, C.sidewalk) });
    } else if (isRoad) {
      paint(id, { "line-color": byZoom(C.road, C.pavement) });
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
      "fill-color": ["match", ["get", "type"], COMMERCIAL, C.buildingCommercial, C.building],
      "fill-outline-color": ["match", ["get", "type"], COMMERCIAL, C.buildingCommercialEdge, C.buildingEdge],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.5, 1],
    },
  });
  paint("building-extrusion", {
    "fill-extrusion-color": ["match", ["get", "type"], COMMERCIAL, C.buildingCommercial, C.buildingExtrusion],
  });

  // Station platforms and passages underground: translucent red footprints over the street grid
  paint("building-underground", {
    "fill-color": C.platform,
    "fill-outline-color": C.platformEdge,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 0.45],
  });
  paint("tunnel-path", { "line-color": C.platformEdge });

  // Labels: one gray family, white halos, upright POI names, blue water and green park names
  // Street names small, uppercase and letterspaced, so they read as annotation under the lines
  paint("road-label-navigation", { "text-color": C.label, "text-halo-color": "#FFFFFF", "text-halo-width": 1.25 });
  layout("road-label-navigation", {
    "text-transform": "uppercase",
    "text-letter-spacing": 0.06,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 8, 16, 9.5, 18, 11],
  });
  paint("poi-label", { "text-color": C.labelSoft, "text-halo-width": 1, "text-halo-blur": 0 });
  layout("poi-label", { "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] });
  paint("settlement-subdivision-label", { "text-color": C.labelSoft });
  for (const id of ["water-point-label", "water-line-label", "waterway-label"]) {
    paint(id, { "text-color": C.waterLabel, "text-halo-color": "rgba(255, 255, 255, 0.7)" });
  }
  for (const id of ["natural-point-label", "natural-line-label"]) {
    paint(id, { "text-color": C.parkLabel });
  }

  // Subway lines: official colors, solid, with a white casing so parallel and crossing lines separate
  for (const layer of style.layers) {
    if (!layer.id.startsWith("mta-")) continue;
    let json = JSON.stringify(layer);
    for (const [from, to] of Object.entries(LINE_COLORS)) json = json.split(from).join(to);
    Object.assign(layer, JSON.parse(json));
  }
  const lines = byId.get("mta-subwaylines-all");
  if (lines) {
    paint("mta-subwaylines-all", { "line-width": SUBWAY_WIDTH, "line-opacity": 1 });
    insertBefore("mta-subwaylines-all", {
      ...JSON.parse(JSON.stringify(lines)),
      id: "theme-subwaylines-casing",
      paint: { "line-color": "#FFFFFF", "line-width": SUBWAY_CASING_WIDTH, "line-opacity": 1 },
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
    "text-color": "#1D1D1F",
    "text-halo-color": "#FFFFFF",
    "text-halo-width": 1.5,
    "text-halo-blur": 0.5,
    "text-opacity": ["step", ["zoom"], 0, 13, 1, 15, 0],
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
    "text-color": "#8A8883",
    // Matches the raw Studio style's original threshold (and the accessible labels' own) —
    // was bumped to 14 here, making inaccessible names only show up a zoom level closer in
    "text-opacity": ["step", ["zoom"], 0, 13, 1],
  });

  // Street elevators: the app's "outages" layer draws one marker per elevator (components/ElevatorMarker).
  // This export layer keeps the "Street Elevator" labels and tap target, and keeps its icon only for ramps
  const isRamp = ["==", ["slice", ["downcase", ["get", "elevatorno"]], 0, 2], "ra"];
  layout("transit-elevators", { "icon-image": ["case", isRamp, "ramp", ""] });
  paint("transit-elevators", { "text-color": C.label, "text-halo-color": "#FFFFFF", "text-halo-width": 1.25 });

  return style as T;
}

