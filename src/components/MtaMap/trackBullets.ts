import mapboxgl from "mapbox-gl";
import { mapColors } from "@/styles/mapColors";

// Line bullets on the tracks, placed the way Apple Maps does it: a group like A·C·E runs along the
// line one bullet after another, but every bullet stays upright. Mapbox's own line labels can only do
// one or the other, so after each zoom or pan this walks the visible track geometry, lays groups out
// at a fixed screen spacing, and hands the bullet positions to a plain point layer.

const SOURCE = "theme-track-bullets";
const LAYER = "theme-track-bullets";
const BEFORE_LAYER = "directionLabel_east"; // above the lines, below stations and elevators
const MIN_ZOOM = 13;

const BULLET = 12; // diameter, CSS px
const RING = 1.5; // white ring so a bullet reads on its own line color
const GAP = 1.5; // between bullets in a group
const STEP = BULLET + RING * 2 + GAP; // centre to centre along the track
const GROUP_SPACING = 280; // between groups on the same line, screen px

const COLORS: Record<string, string> = {
  A: "#0039A6", C: "#0039A6", E: "#0039A6",
  "1": "#EE352E", "2": "#EE352E", "3": "#EE352E",
  "4": "#00933C", "5": "#00933C", "6": "#00933C",
  B: "#FF6319", D: "#FF6319", F: "#FF6319", M: "#FF6319",
  N: "#FCCC0A", Q: "#FCCC0A", R: "#FCCC0A", W: "#FCCC0A",
  "7": "#B933AD", J: "#996633", Z: "#996633", G: "#6CBE45",
  L: "#A7A9AC", S: "#808183", SIR: "#0039A6",
};
// Yellow bullets carry black letters, as on MTA signage
const DARK_TEXT = new Set(["N", "Q", "R", "W"]);
const imageId = (route: string) => `theme-bullet-${route}`;

function drawBullet(route: string, ratio: number) {
  const size = BULLET + RING * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(size * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(ratio, ratio);
  const c = size / 2;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fillStyle = mapColors.surface;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, BULLET / 2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[route];
  ctx.fill();
  ctx.fillStyle = DARK_TEXT.has(route) ? mapColors.ink : mapColors.surface;
  ctx.font = `700 ${route.length > 1 ? 5 : 8.5}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(route, c, c + 0.5);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

type Pt = [number, number];

// Track geometry in "world pixels" at the current zoom, so spacing can be measured on screen
function toWorld(lngLat: Pt, worldSize: number): Pt {
  const m = mapboxgl.MercatorCoordinate.fromLngLat(lngLat);
  return [m.x * worldSize, m.y * worldSize];
}
function toLngLat([x, y]: Pt, worldSize: number): Pt {
  const { lng, lat } = new mapboxgl.MercatorCoordinate(x / worldSize, y / worldSize).toLngLat();
  return [lng, lat];
}

// Point at distance `d` along a polyline, given its cumulative lengths
function pointAt(line: Pt[], cum: number[], d: number): Pt {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
}

function layoutBullets(map: mapboxgl.Map): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (map.getZoom() < MIN_ZOOM) return { type: "FeatureCollection", features };

  const worldSize = 512 * Math.pow(2, map.getZoom());
  // Groups already placed, so the same line doesn't repeat too soon and neighbouring lines don't collide
  // (groups sharing a line, like N·Q·R and N·Q·W on Broadway, count as the same line)
  const placed: { routes: string[]; at: Pt }[] = [];
  const tooClose = (routes: string[], p: Pt) =>
    placed.some((g) => {
      const d = Math.hypot(g.at[0] - p[0], g.at[1] - p[1]);
      return g.routes.some((r) => routes.includes(r)) ? d < GROUP_SPACING * 0.8 : d < STEP * 3;
    });
  const tracks = [
    ...map.querySourceFeatures("composite", { sourceLayer: "mta_subwaylines" }),
    ...map.querySourceFeatures("composite", { sourceLayer: "mta_sir_lines" }),
  ];

  for (const track of tracks) {
    const name = String(track.properties?.name ?? "");
    const routes = name === "SIR" ? ["SIR"] : name.split("-").filter((r) => COLORS[r]);
    if (routes.length === 0) continue;
    const geom = track.geometry;
    const parts =
      geom.type === "LineString" ? [geom.coordinates] : geom.type === "MultiLineString" ? geom.coordinates : [];

    for (const part of parts) {
      const line = part.map((p) => toWorld(p as Pt, worldSize));
      const cum = [0];
      for (let i = 1; i < line.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
      }
      const length = cum[cum.length - 1];
      const groupLength = routes.length * STEP;
      if (length < groupLength + 8) continue;

      // Tracks arrive as short pieces (often one per stretch between stations): give each piece
      // evenly spaced groups, at least one, then drop any that land too close to another group
      const count = Math.max(1, Math.floor(length / GROUP_SPACING));
      for (let g = 0; g < count; g++) {
        const at = (length * (g + 0.5)) / count;
        const centre = pointAt(line, cum, at);
        if (tooClose(routes, centre)) continue;
        placed.push({ routes, at: centre });

        // Read top-to-bottom on steep tracks, left-to-right on flat ones
        const ahead = pointAt(line, cum, Math.min(length, at + 1));
        const [dx, dy] = [ahead[0] - centre[0], ahead[1] - centre[1]];
        const forward = Math.abs(dy) > Math.abs(dx) ? dy > 0 : dx > 0;
        const ordered = forward ? routes : [...routes].reverse();

        ordered.forEach((route, i) => {
          const d = at + (i - (routes.length - 1) / 2) * STEP;
          features.push({
            type: "Feature",
            properties: { image: imageId(route) },
            geometry: { type: "Point", coordinates: toLngLat(pointAt(line, cum, d), worldSize) },
          });
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}

/** Call once with the new map. Adds the bullet layer on load and keeps it laid out as the view changes. */
export function attachTrackBullets(map: mapboxgl.Map) {
  map.on("styleimagemissing", ({ id }: { id: string }) => {
    const route = id.startsWith("theme-bullet-") ? id.slice("theme-bullet-".length) : null;
    if (!route || !COLORS[route] || map.hasImage(id)) return;
    const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    const image = drawBullet(route, ratio);
    if (image) map.addImage(id, image, { pixelRatio: ratio });
  });

  let frame = 0;
  let removed = false;
  const refresh = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (removed) return;
      const source = map.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined;
      source?.setData(layoutBullets(map));
    });
  };
  // The map is torn down when MtaMap remounts; drop any layout still waiting for a frame
  map.on("remove", () => {
    removed = true;
    cancelAnimationFrame(frame);
  });

  map.on("load", () => {
    map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer(
      {
        id: LAYER,
        type: "symbol",
        source: SOURCE,
        minzoom: MIN_ZOOM,
        layout: {
          "icon-image": ["get", "image"],
          "icon-rotation-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      },
      map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined,
    );
    refresh();
  });
  // Spacing is in screen pixels, so lay out again once a zoom or pan settles, and as track tiles arrive
  map.on("moveend", refresh);
  map.on("sourcedata", (e: mapboxgl.MapSourceDataEvent) => {
    if (e.sourceId === "composite" && e.isSourceLoaded) refresh();
  });
}
