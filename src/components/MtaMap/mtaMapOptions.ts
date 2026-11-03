import mapStyle from "@/styles/mapbox-style.json";
import { applyMapTheme } from "@/styles/mapTheme";
import { LngLatBounds, StyleSpecification } from "mapbox-gl";

import boroughData from "@/resources/nyc_boroughs.json";
import type { BoroughCollection } from "@/utils/types";

// Built once: the Studio export with the app's map theme applied
const themedStyle = applyMapTheme(mapStyle) as unknown as StyleSpecification;

export const DEFAULT_ZOOM = 13;
export const DEFAULT_CENTER: [number, number] = [-73.98465318925187, 40.7564263693059];
// Tuned at the Manhattan tilt — the system sits off-center on screen once rotated
export const BIRDSEYE_CENTER: [number, number] = [-73.83498613423828, 40.804639553395816];
export const BIRDSEYE_CENTER_DESKTOP: [number, number] = [-73.925, 40.755]; // slightly NE for desktop (panel on left shifts view)
// Separate centers for true north (bearing 0)
export const BIRDSEYE_CENTER_TRUE_NORTH: [number, number] = [-73.89998613423828, 40.800639553395816];
export const BIRDSEYE_CENTER_TRUE_NORTH_DESKTOP: [number, number] = [-73.975, 40.755];
export const BIRDSEYE_ZOOM = 10.009972810309067;

const DEFAULT_BEARING = setManhattanTilt();

export function setManhattanTilt() { 
  const manhattanTilt = 29;
  return manhattanTilt;
}

const data = boroughData as unknown as BoroughCollection;
let manhattanPolygon: number[][][][] | null = null;

function getManhattanPolygon(): number[][][][] {
  if (manhattanPolygon) return manhattanPolygon;
  const manhattan = data.features.find((f) => f.properties.borocode === "1");
  if (!manhattan) throw new Error("Manhattan not found in borough data");
  manhattanPolygon = manhattan.geometry.coordinates;
  return manhattanPolygon;
}

function pointInPolygon(lng: number, lat: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInManhattan(lng: number, lat: number): boolean {
  return getManhattanPolygon().some((polygon) =>
    pointInPolygon(lng, lat, polygon[0])
  );
}

export function getBearingByLocation(lng: number, lat: number): number {
  return isInManhattan(lng, lat) ? setManhattanTilt() : 0;
}

export function userIsInBounds(lng: number, lat: number): boolean {
  const bounds = setMaxBounds();
  return (
    lng >= bounds.getWest() &&
    lng <= bounds.getEast() &&
    lat >= bounds.getSouth() &&
    lat <= bounds.getNorth()
  );
}

export async function setMapCenter(): Promise<{ center: [number, number]; bearing: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ center: DEFAULT_CENTER, bearing: DEFAULT_BEARING });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords: { longitude: lng, latitude: lat } }) => {
        if (!userIsInBounds(lng, lat)) {
          resolve({ center: DEFAULT_CENTER, bearing: DEFAULT_BEARING });
          return;
        }
        resolve({
          center: [lng, lat],
          bearing: isInManhattan(lng, lat) ? setManhattanTilt() : 0,
        });
      },
      () => resolve({ center: DEFAULT_CENTER, bearing: DEFAULT_BEARING }),
      { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false } // false for a faster load
    );
  });
}

export function setMaxBounds() : mapboxgl.LngLatBounds {
  return new LngLatBounds (
    [-74.27817742272136, 40.33201072974728], // Southwest coordinates
    [-73.74259392662758, 41.209774899555896] // Northeast coordinates
  );
}

export const getMtaMapOptions = (container, pitch) => {
  let mapPitch = null;
  const bearing = setManhattanTilt();
  const bounds = setMaxBounds();

  if (pitch > 0) {
    mapPitch = 0;
  } else mapPitch = 0;

  return {
    container,
    style: themedStyle,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    bearing,
    pitch: mapPitch,
    minZoom: 9,
    maxBounds: bounds || null,
    attributionControl: false,
  };
};

export const outageSourceOptions = {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [],
  },
  dynamic: true,
  generateId: true,
};

export const complexBoundarySourceOptions = {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [],
  },
};



