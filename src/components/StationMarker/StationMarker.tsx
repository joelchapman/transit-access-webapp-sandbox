import React from "react";
import { Accessibility, Wrench } from "lucide-react";

// How a station shows on the map. The state is carried by shape first and color second, so it
// reads for colorblind riders and in glare: a plain marker when every elevator works, a gray marker
// with a yellow dot when some are out, a red marker with a crossed-out wrench when all are out, and
// a small gray dot for stations with no step-free access at all. Icons are Lucide's; this component
// only wraps them.
//
// The map can't render React, so stationMarkerImages.ts renders this to SVG and hands Mapbox
// the bitmap. The legend renders it directly, so both always match.

export type StationAccess = "ok" | "partial" | "out" | "none";

const TONES = {
  ok: { fill: "#1D9DB8" },
  partial: { fill: "oklch(0.56 0.02 255)", dot: "#F2A900" },
  out: { fill: "#D33A2C" },
} as const;

// Square canvas, marker dead centre so it sits on the track; the dot tucks into the top-right corner
export const MARKER_SIZE = 34;
const CENTER = MARKER_SIZE / 2;
const RADIUS = 12;
const RING = 2;

export function StationMarker({ access, size = MARKER_SIZE }: { access: StationAccess; size?: number }) {
  if (access === "none") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${MARKER_SIZE} ${MARKER_SIZE}`} aria-hidden="true">
        <circle cx={CENTER} cy={CENTER} r={6} fill="#FFFFFF" stroke="oklch(0.62 0.018 255)" strokeWidth={2.5} />
      </svg>
    );
  }

  const tone = TONES[access];
  const icon = 15;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${MARKER_SIZE} ${MARKER_SIZE}`} aria-hidden="true">
      <circle cx={CENTER} cy={CENTER} r={RADIUS + RING} fill="#FFFFFF" />
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={tone.fill} />
      {access === "out" ? (
        <WrenchOff x={CENTER - icon / 2} y={CENTER - icon / 2} size={icon} />
      ) : (
        <Accessibility
          x={CENTER - icon / 2}
          y={CENTER - icon / 2}
          width={icon}
          height={icon}
          color="#FFFFFF"
          strokeWidth={2.4}
        />
      )}
      {"dot" in tone && (
        <>
          <circle cx={27.5} cy={6.5} r={6.5} fill="#FFFFFF" />
          <circle cx={27.5} cy={6.5} r={4.75} fill={tone.dot} />
        </>
      )}
    </svg>
  );
}

// Lucide has no wrench-off, so this is its wrench with the slash its other "-off" icons use. A red
// casing under the slash cuts a gap where it crosses the wrench, the way Lucide's off icons do.
function WrenchOff({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Wrench color="#FFFFFF" strokeWidth={2.4} />
      <line x1={2} y1={2} x2={22} y2={22} stroke={TONES.out.fill} strokeWidth={6} />
      <line x1={2} y1={2} x2={22} y2={22} stroke="#FFFFFF" strokeWidth={2.4} />
    </svg>
  );
}

// Zoomed in to street level, a station becomes a white capsule: a big, obvious tap target.
// The border still carries isOut/isProblem status color, same as every other zoom, so the
// complex layer never goes fully neutral — just quieter than the full colored marker.
export const PILL_WIDTH = 46;
export const PILL_HEIGHT = 26;

export function StationPill({ access }: { access?: StationAccess } = {}) {
  // Some-out's marker is gray with a yellow dot; the capsule has no dot, so its border takes the yellow
  const stroke =
    access === "partial"
      ? TONES.partial.dot
      : access && access !== "none"
        ? TONES[access].fill
        : "oklch(0.82 0.012 255)";
  return (
    <svg width={PILL_WIDTH} height={PILL_HEIGHT} viewBox={`0 0 ${PILL_WIDTH} ${PILL_HEIGHT}`} aria-hidden="true">
      <rect x={3} y={3} width={PILL_WIDTH - 6} height={PILL_HEIGHT - 6} rx={(PILL_HEIGHT - 6) / 2} fill="#FFFFFF" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}

export default StationMarker;
