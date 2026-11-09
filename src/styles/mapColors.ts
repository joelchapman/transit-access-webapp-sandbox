// Semantic colors for everything drawn outside the DOM: marker SVGs are rasterized to bitmaps and
// Mapbox paint properties don't resolve CSS variables or parse oklch, so neither can read globals.css.
// That covers both the app's own markers/highlights below and the base map's own colors (land, roads,
// buildings, labels, official subway line colors) applied over the Mapbox Studio export in
// mapCustomization.ts. DOM/Tailwind components use globals.css's oklch tokens instead — those are
// dark-mode-aware in a way flat hex values here aren't, so this file stays scoped to what truly can't
// read them. The grays mirror the ramp there (hue 255); keep the two in step.
export const mapColors = {
  surface: "#FFFFFF", // --gray-0
  ink: "#161D27", // --gray-900
  label: "#3B434E", // --gray-800, 7:1 on every map surface
  markerPartial: "#6C7582", // --gray-600
  markerNone: "#7E8792", // --gray-500
  markerOutline: "#BFC5CC", // --gray-400
  markerWrench: "#555E6A", // oklch(0.48 0.022 255)
  markerShadow: "rgba(22, 29, 39, 0.22)", // --gray-900 at 22%

  statusOk: "#1D9DB8",
  statusPartial: "#E39B0B",
  statusPartialDot: "#F2A900",
  statusOut: "#D33A2C",

  stationGlow: "#2bb7ce",
  elevatorHighlight: "#D46BB8",
  elevatorHighlightLine: "#de91cd",
  complexHighlight: "#ffff00",

  // Base map: ground, water, parks (mapCustomization.ts's land/water/park layers)
  land: "#EFF2F6",
  landLow: "#F2F5F9",
  landStreet: "#EFF2F6",
  park: "#DDEBD5",
  water: "#B7DCF4",
  waterLabel: "#14405F",
  parkLabel: "#2C4D23",

  // Streets
  roadCase: "#E1E3E7",
  majorCase: "#D8DBDE",
  pavement: "#DADDE1",
  sidewalk: "#F7FAFE",
  tunnel: "#EAEDF1",

  // Buildings and underground station footprints
  building: "#E4E7EB",
  buildingEdge: "#D6D9DC",
  buildingCommercial: "#F1E3C1",
  buildingCommercialEdge: "#E3D2A9",
  buildingExtrusion: "#ECEFF3",
  platform: "#F2A3A3",
  platformEdge: "#E48686",

  // Labels other than the app's own markers (road names, POIs, place names) — a quieter shade
  // than `label`, kept as its own key even though it's the same value today, in case they diverge
  labelSoft: "#3B434E",
} as const;

// Official MTA line colors, keyed by the Mapbox Studio export's own approximate color for each —
// mapCustomization.ts substitutes these wherever a Studio layer uses the approximation
export const MTA_LINE_COLOR_SUBSTITUTIONS: Record<string, string> = {
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
