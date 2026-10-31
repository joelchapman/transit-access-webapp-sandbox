import { useEffect, useMemo, useState } from "react";
import { userIsInBounds } from "@/components/MtaMap/mtaMapOptions";
import {
  getNearbyComplexes,
  getElevatorsByComplexId,
  getComplexOutageLayerFeatures,
  getComplexMaintenanceToday,
  distanceMiles,
  WALKING_DISTANCE_FACTOR,
} from "@/utils/dataUtils";

// Nearby-station logic from the original NearbyStationsPopup, minus its panel UI.

type LngLat = [number, number];

export const WALKING_RADII: { label: string; value: number | null }[] = [
  { label: "500 ft", value: 500 / 5280 },
  { label: "¼ mi", value: 0.25 },
  { label: "½ mi", value: 0.5 },
  { label: "1 mi", value: 1 },
  { label: "1.5 mi", value: 1.5 },
  { label: "2 mi", value: 2 },
  { label: "3 mi", value: 3 },
  { label: "Any", value: null },
];

export function formatWalkingDistance(miles: number) {
  if (miles < 0.25) return `${Math.round(miles * 5280).toLocaleString()} ft`;
  if (Math.abs(miles - 0.25) <= 0.001) return "¼ mi";
  if (Math.abs(miles - 0.5) <= 0.001) return "½ mi";
  if (Math.abs(miles - 0.75) <= 0.001) return "¾ mi";
  return `${miles % 1 === 0 ? miles : miles.toFixed(1)} mi`;
}

const isStreetElevator = (el: any) =>
  typeof el.properties.isStreet === "string"
    ? el.properties.isStreet === "true"
    : Boolean(el.properties.isStreet);

// Distance to the closest street elevator, since that's where a wheelchair user enters
function distanceToEntrance(complex: any, [lng, lat]: LngLat) {
  const streetEls = getElevatorsByComplexId(complex.properties.complex_id).filter(isStreetElevator);
  if (streetEls.length === 0) {
    const [cLng, cLat] = complex.geometry.coordinates;
    return distanceMiles(lng, lat, cLng, cLat);
  }
  return Math.min(
    ...streetEls.map((el: any) => {
      const [elLng, elLat] = el.geometry.coordinates;
      return distanceMiles(lng, lat, elLng, elLat);
    }),
  );
}

export interface NearbyStation {
  complexId: string;
  name: string;
  routes: string[];
  adaNotes: string | null;
  status: "ok" | "partial" | "out";
  outCount: number;
  outElevators: any[];
  walkingMiles: number;
  walkMinutes: number | null;
  maintenanceLabel: string | null;
  feature: any;
}

interface Options {
  userLocation: LngLat | null;
  overrideLocation: LngLat | null;
  elevatorData: any[] | null;
  stationOutages: any[] | null;
  upcomingElevatorData: any[] | null;
}

export function useNearbyStations({
  userLocation,
  overrideLocation,
  elevatorData,
  stationOutages,
  upcomingElevatorData,
}: Options) {
  const [radius, setRadius] = useState<number | null>(1);
  const [fallbackLocation, setFallbackLocation] = useState<LngLat | null>(null);

  // "Any" distance with no Mapbox geolocate fix (e.g. user outside NYC): ask directly
  useEffect(() => {
    if (radius !== null || userLocation || fallbackLocation) return;
    navigator.geolocation?.getCurrentPosition(({ coords: { longitude, latitude } }) =>
      setFallbackLocation([longitude, latitude]),
    );
  }, [radius, userLocation, fallbackLocation]);

  const origin = overrideLocation ?? userLocation ?? (radius === null ? fallbackLocation : null);
  const userInBounds = userLocation !== null && userIsInBounds(userLocation[0], userLocation[1]);
  const isUsingPin = !!overrideLocation;

  const complexes = useMemo(() => {
    if (!origin) return [];
    const [lng, lat] = origin;
    if (radius === null) return getNearbyComplexes(lng, lat, Infinity);

    // radius is walking distance; the spatial filter works in straight-line miles
    const crowFliesRadius = radius / WALKING_DISTANCE_FACTOR;
    // 0.1 mi buffer catches complexes whose centroid is just outside but whose entrance is inside
    return getNearbyComplexes(lng, lat, crowFliesRadius + 0.1)
      .map((complex: any) => ({ ...complex, distance: distanceToEntrance(complex, origin) }))
      .filter((c: any) => c.distance <= crowFliesRadius + 0.05)
      .sort((a: any, b: any) => a.distance - b.distance);
  }, [origin, radius]);

  const outageByComplex = useMemo(() => {
    if (!stationOutages) return new Map();
    return new Map(
      getComplexOutageLayerFeatures(stationOutages).map((f: any) => [f.properties.complex_id, f.properties]),
    );
  }, [stationOutages]);

  const stations: NearbyStation[] = useMemo(
    () =>
      complexes.map((complex: any) => {
        const complexId = complex.properties.complex_id;
        const outage = outageByComplex.get(complexId);
        const outElevators = getElevatorsByComplexId(complexId).filter((el: any) =>
          elevatorData?.some(
            (out) => out.elevatorNo?.toLowerCase() === el.properties.elevatorno?.toLowerCase(),
          ),
        );
        // Distances shown are always from the real GPS fix, even when the list follows the map pin
        const miles = userLocation ? distanceToEntrance(complex, userLocation) : complex.distance;
        const walkingMiles = miles * WALKING_DISTANCE_FACTOR;
        const withinRadius = radius !== null && miles <= radius / WALKING_DISTANCE_FACTOR;

        return {
          complexId,
          name: complex.properties.stop_name,
          routes: (complex.properties.route || "").split(" ").filter(Boolean),
          adaNotes: complex.properties.ada_notes || null,
          status: outage?.isOut ? "out" : outage?.isProblem ? "partial" : "ok",
          outCount: outElevators.length,
          outElevators,
          walkingMiles,
          walkMinutes: userInBounds && !isUsingPin && withinRadius ? Math.max(1, Math.round(walkingMiles * 20)) : null,
          maintenanceLabel: getComplexMaintenanceToday(complexId, upcomingElevatorData),
          feature: {
            geometry: complex.geometry,
            properties: {
              complex_id: complexId,
              station_id: (complex.properties.station_ids || "").split("/")[0].trim(),
              ada_notes: complex.properties.ada_notes || null,
            },
          },
        };
      }),
    [complexes, outageByComplex, elevatorData, userLocation, userInBounds, isUsingPin, radius, upcomingElevatorData],
  );

  return {
    stations,
    radius,
    setRadius,
    hasLocation: origin !== null,
    isUsingPin,
    showDistances: userInBounds || isUsingPin,
  };
}
