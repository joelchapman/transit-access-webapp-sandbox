// naming convention: file is plural, export is singular.
// import runs into ts type problems when they're the same (unconfirmed but suspected)

export const elevatorView = 16;
export const dotView = 12;
export const offsetDistance = -22;
export const circleOffsetDistance = -10;

export const currentOutageProps = {
  id: "outages",
  source: "outage-data",
  // Street elevators only (platform elevators aren't on the map); ramps keep their own ramp icon
  filter: [
    "all",
    ["==", ["get", "isStreet"], true],
    ["!=", ["slice", ["downcase", ["to-string", ["get", "elevatorno"]]], 0, 2], "ra"],
  ],
  type: "symbol", // Using symbol type for icon display
  layout: {
    // One marker per street elevator (see ElevatorMarker): a red octagon badge when it's out
    "icon-image": ["case", ["==", ["get", "isBroken"], true], "elevator-marker-out", "elevator-marker-ok"],
    "icon-size": ["step", ["zoom"], 0, elevatorView - 1, 0.95],
    "icon-anchor": "center",
    "icon-allow-overlap": ["step", ["zoom"], false, elevatorView, true],
    "icon-ignore-placement": true,
    "icon-padding": 2,
    // "auto" respects symbol-sort-key for collision resolution; "source" ignores it.
    "symbol-z-order": "auto",
    // Broken elevators win over working ones when icons would overlap.
    "symbol-sort-key": ["case", ["==", ["get", "isBroken"], true], 2, 1],

    "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 22, 10],
    "text-radial-offset": ["interpolate", ["linear"], ["zoom"], 0, 1.2, 17, 2],

    "text-padding": ["interpolate", ["linear"], ["zoom"], 0, 0, 15, 0, 16, 2],
    "text-offset": [1.5, 0],
  },
  paint: {
    "icon-opacity": ["step", ["zoom"], 0, elevatorView-1, 1],
  },
};

export const stationOutageProps = {
  id: "stationOutages",
  source: "station-outage-data",
  type: "symbol",
  layout: {
    // One access marker per accessible station (see StationMarker): status by badge shape and color
    "icon-image": [
      "case",
      ["==", ["get", "isProblem"], false], "station-marker-ok",
      ["==", ["get", "isOut"], true], "station-marker-out",
      ["==", ["get", "isProblem"], true], "station-marker-partial",
      "",
    ],
    "icon-size": ["interpolate", ["linear"], ["zoom"], dotView, 0.8, elevatorView - 1, 1],
    "icon-anchor": "center",
    "icon-allow-overlap": ["step", ["zoom"], true, elevatorView, false],
    "icon-padding": 0,
    // "auto" respects symbol-sort-key for collision resolution; "source" ignores it.
    "symbol-z-order": "auto",
    // isProblem (partial) > isOut (all elevators down) >  working — station problems
    // remain visible when stations are close together, example at 74 Broadway or Columbus Circle.
    // isProblem on top for case where a complex has options even if one of its stations is out
    "symbol-sort-key": [
      "case",
      ["==", ["get", "isOut"], true], 2,
      ["==", ["get", "isProblem"], true], 3,
      1,
    ],

    "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 22, 10],
    "text-radial-offset": ["interpolate", ["linear"], ["zoom"], 0, 1.2, 17, 2],

    "text-padding": ["interpolate", ["linear"], ["zoom"], 0, 0, 15, 0, 16, 2],
    "text-offset": [1.5, 0],
  },
  paint: {
    // Hidden below dotView (dots take over); hands off to the street-level station capsule
    // (stationComplexProps) at the zoom it appears, so the two never show together
    "icon-opacity": ["step", ["zoom"], 0, dotView, 1, elevatorView - 1, 0],
  },
};

// Low-zoom dots replace stationOutageProps icons below zoom 10.
export const stationDotProps = {
  id: "stationDots",
  source: "station-outage-data",
  type: "circle",
  layout: {
    // Higher sort key renders on top — makes sure red/yellow dots are never
    // covered by a blue dot at the same location.
    "circle-sort-key": [
      "case",
      ["==", ["get", "isOut"], true], 3,
      ["==", ["get", "isProblem"], true], 2,
      1,
    ],
  },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 10, 3.5],
    "circle-color": [
      "case",
      ["==", ["get", "isOut"], true],     "#D33A2C", // red   — all elevators out
      ["==", ["get", "isProblem"], true], "#E39B0B", // amber — partial outage
      "#1D9DB8",                                     // teal  — all working (same as StationMarker)
    ],
    "circle-translate-anchor": "viewport",
    "circle-stroke-width": 1,
    "circle-stroke-color": "#FFFFFF",
    "circle-opacity": ["step", ["zoom"], 1, dotView, 0],
    "circle-stroke-opacity": ["step", ["zoom"], 1, dotView, 0],
  },
};

export const animationProps = {
  id: "outage-glow",
  type: "circle",
  source: "station-outage-data",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 10, 
      17, 20, 
      18, 0,
    ],
    "circle-color": "#2bb7ce", // Bright teal glow color
    "circle-opacity": 0,
    "circle-blur": 0.6,
    "circle-translate": [0, -20],
  },
  filter: ["==", ["get", "isProblem"], false], // Only working elevators pulse
};