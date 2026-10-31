// naming convention: file is plural, export is singular.
// import runs into ts type problems when they're the same (unconfirmed but suspected)

import { elevatorView } from "../CurrentOutages/currentOutagesProps";

export const stationComplexProps = {
  id: "mta-subway-complexes-accessible2",
  source: "station-complexes",
  type: "symbol",
  filter: ["match", ["get", "ada"], ["2", "1"], true, false],
  layout: {
    "text-size": 12,
    "text-radial-offset": 1.5,
    "text-allow-overlap": ["step", ["zoom"], false, elevatorView, true],
    "symbol-sort-key": 10,
    "symbol-z-order": "auto",
    "text-variable-anchor": ["bottom", "right", "top", "left"],
    // Street-level zoom: a white capsule tap target, border colored the same as every other zoom
    "icon-image": [
      "case",
      ["==", ["get", "isProblem"], false], "station-pill-ok",
      ["==", ["get", "isOut"], true], "station-pill-out",
      ["==", ["get", "isProblem"], true], "station-pill-partial",
      "station-pill-ok",
    ],
"text-font": ["Montserrat Bold", "Arial Unicode MS Regular"],
        "icon-allow-overlap": ["step", ["zoom"], true, elevatorView-2, true],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.85, 17, 1.1],
        "text-anchor": ["step", ["zoom"], "left", 17, "top"],
        "text-field": ["to-string", ["get", "stop_name"]]
      },
      "paint": {
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
        "text-halo-blur": 1,
        "text-translate": [
          "step",
          ["zoom"],
          ["literal", [0, 0]],
          17,
          ["literal", [0, 5]]
        ],
        "text-opacity": ["step", ["zoom"], 0, elevatorView-1, 1],
        "icon-opacity": ["step", ["zoom"], 0, elevatorView-1, 1]
      },
};