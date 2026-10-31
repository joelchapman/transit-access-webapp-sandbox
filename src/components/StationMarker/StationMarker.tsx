import React from "react";
import { Accessibility, TriangleAlert, OctagonX } from "lucide-react";

// How a station shows on the map. The state is carried by shape first and color second, so it
// reads for colorblind riders and in glare: a plain marker when every elevator works, a triangle
// badge when some are out, an octagon badge when all are out, and a small gray dot for stations
// with no step-free access at all. Icons are Lucide's; this component only wraps them.
//
// The map can't render React, so stationMarkerImages.ts renders this to SVG and hands Mapbox
// the bitmap. The legend renders it directly, so both always match.

export type StationAccess = "ok" | "partial" | "out" | "none";

const TONES = {
  ok: { fill: "#1D9DB8" },
  partial: { fill: "#E39B0B", badge: "#9A5A00", Badge: TriangleAlert },
  out: { fill: "#D33A2C", badge: "#B3221B", Badge: OctagonX },
} as const;

// Square canvas, marker dead centre so it sits on the track; the badge tucks into the top-right corner
export const MARKER_SIZE = 34;
const CENTER = MARKER_SIZE / 2;
const RADIUS = 12;
const RING = 2;

export function StationMarker({ access, size = MARKER_SIZE }: { access: StationAccess; size?: number }) {
  if (access === "none") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${MARKER_SIZE} ${MARKER_SIZE}`} aria-hidden="true">
        <circle cx={CENTER} cy={CENTER} r={6} fill="#FFFFFF" stroke="#8A8883" strokeWidth={2.5} />
      </svg>
    );
  }

  const tone = TONES[access];
  const Badge = "Badge" in tone ? tone.Badge : null;
  const icon = 15;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${MARKER_SIZE} ${MARKER_SIZE}`} aria-hidden="true">
      <circle cx={CENTER} cy={CENTER} r={RADIUS + RING} fill="#FFFFFF" />
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={tone.fill} />
      <Accessibility
        x={CENTER - icon / 2}
        y={CENTER - icon / 2}
        width={icon}
        height={icon}
        color="#FFFFFF"
        strokeWidth={2.4}
      />
      {Badge && "badge" in tone && (
        <>
          <circle cx={27.5} cy={6.5} r={6.5} fill="#FFFFFF" />
          <Badge x={27.5 - 5} y={6.5 - 5} width={10} height={10} color={tone.badge} strokeWidth={2.75} />
        </>
      )}
    </svg>
  );
}


// Zoomed in to street level, a station becomes a plain white capsule: a big, obvious tap target
// that leaves status to the elevators drawn around it, so nothing at this zoom leans on color.
export const PILL_WIDTH = 46;
export const PILL_HEIGHT = 26;

export function StationPill() {
  return (
    <svg width={PILL_WIDTH} height={PILL_HEIGHT} viewBox={`0 0 ${PILL_WIDTH} ${PILL_HEIGHT}`} aria-hidden="true">
      <rect x={3} y={3} width={PILL_WIDTH - 6} height={PILL_HEIGHT - 6} rx={(PILL_HEIGHT - 6) / 2} fill="#FFFFFF" stroke="#C4C1BB" strokeWidth={1.5} />
    </svg>
  );
}

export default StationMarker;
