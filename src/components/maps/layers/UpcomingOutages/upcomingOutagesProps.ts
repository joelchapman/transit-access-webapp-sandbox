// naming convention: file is plural, export is singular.
// import runs into ts type problems when they're the same (unconfirmed but suspected)

import { elevatorView } from "../CurrentOutages/currentOutagesProps";
export const longtermOutageThreshold = 7;

export const upcomingOutageProps = {
  id: "upcoming-outages",
  source: "upcoming-outage-data",
  filter: [">", ["get", "outageDurationDays"], longtermOutageThreshold], // long-term only
  type: "symbol", // Using symbol type for icon display
  layout: {
    // A wrench badge on the bottom-right corner of the elevator's marker (see ElevatorPlannedBadge),
    // shown with the markers so the planned outage sits on the elevator it belongs to
    "icon-image": "elevator-badge-planned",
    "icon-size": ["step", ["zoom"], 0, elevatorView - 1, 0.95],
    "icon-anchor": "center",
    "icon-offset": [11, 11],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "symbol-z-order": "source",
    "symbol-sort-key": 9,
  },
  paint: {
    "icon-opacity": ["step", ["zoom"], 0, elevatorView - 1, 1],
  },
};