import React from "react";
import { MoveVertical, OctagonX, Wrench } from "lucide-react";
import { mapColors } from "@/styles/mapColors";

// A street elevator on the map. Stations are colored circles; elevators are neutral rounded squares,
// so the two never read as the same thing. Status uses the same badge language as stations: no badge
// when it works, Lucide's octagon-x when it's out. A planned outage is a separate wrench badge
// (ElevatorPlannedBadge) that sits on the opposite corner, so it can show alongside "out".
// Icons are Lucide's; these components only wrap them. stationMarkerImages.tsx rasterizes them for
// the map, and the legend renders them directly.

export type ElevatorState = "ok" | "out";

export const ELEVATOR_MARKER_SIZE = 34;
const CENTER = ELEVATOR_MARKER_SIZE / 2;
const SIDE = 24;
const RING = 2;
const FILL = mapColors.ink;

export function ElevatorMarker({ state, size = ELEVATOR_MARKER_SIZE }: { state: ElevatorState; size?: number }) {
  const icon = 15;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${ELEVATOR_MARKER_SIZE} ${ELEVATOR_MARKER_SIZE}`} aria-hidden="true">
      <rect
        x={CENTER - SIDE / 2 - RING}
        y={CENTER - SIDE / 2 - RING}
        width={SIDE + RING * 2}
        height={SIDE + RING * 2}
        rx={9}
        fill={mapColors.surface}
      />
      <rect x={CENTER - SIDE / 2} y={CENTER - SIDE / 2} width={SIDE} height={SIDE} rx={7} fill={FILL} />
      <MoveVertical x={CENTER - icon / 2} y={CENTER - icon / 2} width={icon} height={icon} color={mapColors.surface} strokeWidth={2.6} />
      {state === "out" && (
        <>
          <circle cx={27.5} cy={6.5} r={6.5} fill={mapColors.surface} />
          <OctagonX x={27.5 - 5} y={6.5 - 5} width={10} height={10} color={mapColors.statusOutBadge} strokeWidth={2.75} />
        </>
      )}
    </svg>
  );
}

// A platform elevator (not shown on the map itself, just in lists/legend) — same shape and
// out-state badge as ElevatorMarker, with the fill inverted: white square, dark icon, instead
// of the dark square street elevators use, so the two read as distinct at a glance.
export function ElevatorMarkerInverted({ state, size = ELEVATOR_MARKER_SIZE }: { state: ElevatorState; size?: number }) {
  const icon = 15;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${ELEVATOR_MARKER_SIZE} ${ELEVATOR_MARKER_SIZE}`} aria-hidden="true">
      <rect
        x={CENTER - SIDE / 2 - RING}
        y={CENTER - SIDE / 2 - RING}
        width={SIDE + RING * 2}
        height={SIDE + RING * 2}
        rx={9}
        fill={FILL}
      />
      <rect x={CENTER - SIDE / 2} y={CENTER - SIDE / 2} width={SIDE} height={SIDE} rx={7} fill={mapColors.surface} />
      <MoveVertical x={CENTER - icon / 2} y={CENTER - icon / 2} width={icon} height={icon} color={FILL} strokeWidth={2.6} />
      {state === "out" && (
        <>
          <circle cx={27.5} cy={6.5} r={6.5} fill={mapColors.surface} />
          <OctagonX x={27.5 - 5} y={6.5 - 5} width={10} height={10} color={mapColors.statusOutBadge} strokeWidth={2.75} />
        </>
      )}
    </svg>
  );
}

// Long-term outage coming up: placed on the marker's bottom-right corner by the map layer
export const PLANNED_BADGE_SIZE = 16;

export function ElevatorPlannedBadge({ size = PLANNED_BADGE_SIZE }: { size?: number }) {
  const c = PLANNED_BADGE_SIZE / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${PLANNED_BADGE_SIZE} ${PLANNED_BADGE_SIZE}`} aria-hidden="true">
      <circle cx={c} cy={c} r={c - 0.5} fill={mapColors.surface} />
      <Wrench x={c - 5} y={c - 5} width={10} height={10} color={mapColors.markerWrench} strokeWidth={2.75} />
    </svg>
  );
}

// The selected elevator gets a ring drawn over its marker; the centre stays clear so the marker shows through
export function ElevatorSelectionRing() {
  const side = ELEVATOR_MARKER_SIZE - 3; // just outside the white ring, stroke kept inside the canvas
  return (
    <svg width={ELEVATOR_MARKER_SIZE} height={ELEVATOR_MARKER_SIZE} viewBox={`0 0 ${ELEVATOR_MARKER_SIZE} ${ELEVATOR_MARKER_SIZE}`} aria-hidden="true">
      <rect
        x={CENTER - side / 2}
        y={CENTER - side / 2}
        width={side}
        height={side}
        rx={11}
        fill="none"
        stroke={mapColors.elevatorHighlight}
        strokeWidth={2.5}
      />
    </svg>
  );
}

export default ElevatorMarker;
