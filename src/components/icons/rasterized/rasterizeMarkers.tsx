import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type mapboxgl from "mapbox-gl";
import {
  StationMarker,
  StationPill,
  MARKER_SIZE,
  PILL_WIDTH,
  PILL_HEIGHT,
} from "@/components/icons/variants/StationMarker";
import {
  ElevatorMarker,
  ElevatorPlannedBadge,
  ElevatorSelectionRing,
  ELEVATOR_MARKER_SIZE,
  PLANNED_BADGE_SIZE,
} from "@/components/icons/variants/ElevatorMarker";
import { mapColors } from "@/styles/mapColors";

// Turns the station and elevator marker DOM components (icons/variants/StationMarker,
// icons/variants/ElevatorMarker) into rasterized map images via a hidden canvas (rasterize
// below), and gives their layers a pointer cursor, since the marker and the name beside it are
// both tap targets:
//   station-marker-ok/partial/out/none, station-pill            (StationMarker)
//   elevator-marker-ok/out/selected, elevator-badge-planned     (ElevatorMarker)
// Those same components also render directly as plain DOM elements elsewhere (the Legend,
// StationPage) — this file is only needed because Mapbox's own canvas can't render React.

// Plain JS icon components don't carry a TS type, so this file (a real .tsx consumer) defines
// its own — same four values StationMarker's access prop accepts.
type StationAccess = "ok" | "partial" | "out" | "none";

export const markerImageId = (access: StationAccess) => `station-marker-${access}`;
const ACCESS: StationAccess[] = ["ok", "partial", "out", "none"];
const TAPPABLE_LAYERS = [
  "stationOutages",
  "mta-subway-stations-accessible",
  "mta-subway-stations-inaccessible",
  "mta-subway-complexes-accessible-rt",
  "outages",
  "transit-elevators",
];

function rasterize(element: React.ReactElement, width: number, height: number, ratio: number, shadow: boolean) {
  const svg = renderToStaticMarkup(element).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return new Promise<ImageData | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      // A soft contact shadow lifts it off the map, so it reads as something to press
      if (shadow) {
        ctx.shadowColor = mapColors.markerShadow;
        ctx.shadowBlur = 3 * ratio;
        ctx.shadowOffsetY = 1 * ratio;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Call once with the new map. */
export function attachMarkerImages(map: mapboxgl.Map) {
  const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const add = (id: string, image: ImageData | null) => {
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: ratio });
  };
  // Images decode asynchronously; layers referencing them draw as soon as each is added
  for (const access of ACCESS) {
    rasterize(<StationMarker access={access} />, MARKER_SIZE, MARKER_SIZE, ratio, access !== "none").then((image) =>
      add(markerImageId(access), image),
    );
  }
  // Street-zoom capsule, border colored by status — only ok/partial/out pass this layer's ADA filter
  for (const access of ["ok", "partial", "out"] as const) {
    rasterize(<StationPill access={access} />, PILL_WIDTH, PILL_HEIGHT, ratio, true).then((image) =>
      add(`station-pill-${access}`, image),
    );
  }

  const E = ELEVATOR_MARKER_SIZE;
  rasterize(<ElevatorMarker state="ok" />, E, E, ratio, true).then((image) => add("elevator-marker-ok", image));
  rasterize(<ElevatorMarker state="out" />, E, E, ratio, true).then((image) => add("elevator-marker-out", image));
  rasterize(<ElevatorSelectionRing />, E, E, ratio, false).then((image) => add("elevator-marker-selected", image));
  rasterize(<ElevatorPlannedBadge />, PLANNED_BADGE_SIZE, PLANNED_BADGE_SIZE, ratio, true).then((image) =>
    add("elevator-badge-planned", image),
  );

  // The app adds its station and elevator layers in its own load handler, so wire the cursor once the map settles
  map.once("idle", () => {
    const canvas = map.getCanvas();
    for (const layer of TAPPABLE_LAYERS) {
      if (!map.getLayer(layer)) continue;
      map.on("mouseenter", layer, () => (canvas.style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (canvas.style.cursor = ""));
    }
  });
}
