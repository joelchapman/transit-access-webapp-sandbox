// Semantic colors for what's drawn outside the DOM: marker SVGs are rasterized to bitmaps and Mapbox
// paint properties don't resolve CSS variables or parse oklch, so neither can read globals.css.
// The grays mirror the ramp there (hue 255); keep the two in step.
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
  statusOutBadge: "#B3221B",

  stationGlow: "#2bb7ce",
  elevatorHighlight: "#D46BB8",
  elevatorHighlightLine: "#de91cd",
  complexHighlight: "#ffff00",
} as const;
