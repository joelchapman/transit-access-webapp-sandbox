import { Accessibility, OctagonX } from "lucide-react";
import { mapColors } from "@/styles/mapColors";

// How a station shows on the map. The state is carried by shape first and color second, so it
// reads for colorblind riders and in glare: a plain marker when every elevator works, a gray marker
// with a yellow dot when some are out, a red marker with an octagon X when all are out, and
// a small gray dot for stations with no step-free access at all. Icons are Lucide's; this component
// only wraps them.
//
// This is a plain DOM/SVG element — the Legend and StationPage render it directly. The live
// map can't render React though, so icons/rasterized/rasterizeMarkers.tsx separately rasterizes
// this same component to a bitmap and hands that to Mapbox; both stay in sync automatically
// since they're the exact same component either way.
//
// access is one of "ok" | "partial" | "out" | "none". Usage: <StationMarker access="partial" size={28} />

const TONES = {
  ok: { fill: mapColors.statusOk },
  partial: { fill: mapColors.markerPartial, dot: mapColors.statusPartialDot },
  out: { fill: mapColors.statusOut },
};

// Square canvas, marker dead centre so it sits on the track; the dot tucks into the top-right corner
export const MARKER_SIZE = 34;
const CENTER = MARKER_SIZE / 2;
const RADIUS = 12;
const RING = 2;

/** @param {{ access: "ok" | "partial" | "out" | "none", size?: number }} props */
export function StationMarker({ access, size = MARKER_SIZE }) {
  if (access === "none") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${MARKER_SIZE} ${MARKER_SIZE}`} aria-hidden="true">
        <circle cx={CENTER} cy={CENTER} r={6} fill={mapColors.surface} stroke={mapColors.markerNone} strokeWidth={2.5} />
      </svg>
    );
  }

  const tone = TONES[access];
  const icon = 15;
  const Icon = access === "out" ? OctagonX : Accessibility;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${MARKER_SIZE} ${MARKER_SIZE}`} aria-hidden="true">
      <circle cx={CENTER} cy={CENTER} r={RADIUS + RING} fill={mapColors.surface} />
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={tone.fill} />
      <Icon
        x={CENTER - icon / 2}
        y={CENTER - icon / 2}
        width={icon}
        height={icon}
        color={mapColors.surface}
        strokeWidth={2.4}
      />
      {"dot" in tone && (
        <>
          <circle cx={27.5} cy={6.5} r={6.5} fill={mapColors.surface} />
          <circle cx={27.5} cy={6.5} r={4.75} fill={tone.dot} />
        </>
      )}
    </svg>
  );
}

// Zoomed in to street level, a station becomes a white capsule: a big, obvious tap target.
// The border still carries isOut/isProblem status color, same as every other zoom, so the
// complex layer never goes fully neutral — just quieter than the full colored marker.
export const PILL_WIDTH = 46;
export const PILL_HEIGHT = 26;

/** @param {{ access?: "ok" | "partial" | "out" | "none" }} props */
export function StationPill({ access } = {}) {
  // Some-out's marker is gray with a yellow dot; the capsule has no dot, so its border takes the yellow
  const stroke =
    access === "partial"
      ? TONES.partial.dot
      : access && access !== "none"
        ? TONES[access].fill
        : mapColors.markerOutline;
  return (
    <svg width={PILL_WIDTH} height={PILL_HEIGHT} viewBox={`0 0 ${PILL_WIDTH} ${PILL_HEIGHT}`} aria-hidden="true">
      <rect x={3} y={3} width={PILL_WIDTH - 6} height={PILL_HEIGHT - 6} rx={(PILL_HEIGHT - 6) / 2} fill={mapColors.surface} stroke={stroke} strokeWidth={2} />
    </svg>
  );
}

export default StationMarker;
