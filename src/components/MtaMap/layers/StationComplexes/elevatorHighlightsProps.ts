// naming convention: file is plural, export is singular.
// import runs into ts type problems when they're the same (unconfirmed but suspected)

export const elevatorToComplexHighlightProps = (elevatorId: string | number) => ({
  "id": "elevator-complex-highlight",
  "type": "line" as const,
  "source": "composite",
  "source-layer": "elevator_to_complex_line_connect",
  "filter": ["==", ["get", "elevator_no"], elevatorId] as any,
  "paint": {
    "line-color": "#de91cd",
    "line-width": 6,
    "line-opacity": 0.8,
    "line-blur": 3
  }
});


export const elevatorHighlightProps = (elevatorId: string | number) => ({
  "id": "elevator-highlight",
  "type": "symbol" as const,
  "source": "composite",
  "source-layer": "nyc_transit_elevators",
  "filter": ["==", ["get", "elevatorno"], elevatorId] as any,
  // A ring around the selected elevator's marker (see ElevatorSelectionRing), keeping the marker visible
  "layout" : {
    "icon-image": "elevator-marker-selected",
    "icon-size": 0.95,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
});