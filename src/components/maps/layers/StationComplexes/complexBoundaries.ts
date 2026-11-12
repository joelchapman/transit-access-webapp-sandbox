import { complexCoordinates } from "@/utils/ComplexGeometry";
import { getElevatorsDataset } from "@/lib/dataStore";
import mapboxgl from "mapbox-gl";

// allows for a larger bounding box at big complexes, and a smaller one at small stations
export function getDynamicPadding(coordsArray, mapZoom) {
    if (coordsArray.length <= 1) return 0.00005;
  
    let maxDistance = 0;
    for (let i = 0; i < coordsArray.length; i++) {
      for (let j = i + 1; j < coordsArray.length; j++) {
        const dx = coordsArray[i][0] - coordsArray[j][0];
        const dy = coordsArray[i][1] - coordsArray[j][1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > maxDistance) maxDistance = distance;
      }
    }
  
    // Tighter at higher zoom
    const zoomFactor = Math.pow(1.5, -(mapZoom - 15)); // or tweak base
    const rawPadding = maxDistance * 0.15;
  
    return Math.min(Math.max(rawPadding * zoomFactor, 0.00003), 0.00035);
  }
  
  

export function getComplexBoundaryGeoJSON(zoom: number) {
  const features: any[] = [];
  const complexGroups: Record<string, [number, number][]> = {};

  // First pass: group street elevators by complexID
  getElevatorsDataset().features.forEach((feature) => {
    const { isStreet, complexID } = feature.properties || {};
    if (!complexID) return;

    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return;

    if (!complexGroups[complexID]) {
      complexGroups[complexID] = [];
    }

    // add street elevators
    if (isStreet) {
      complexGroups[complexID].push(coords as [number, number]);
    }
  });

  // Second pass: build GeoJSON for each complex
  Object.entries(complexGroups).forEach(([complexID, coordsArray]) => {
    const fallbackCoord = complexCoordinates[complexID] as [number, number];
    if (
      (!Array.isArray(coordsArray) || coordsArray.length === 0) &&
      (!Array.isArray(fallbackCoord) || fallbackCoord.length !== 2)
    ) {
      console.warn(`No valid coordinates for complexID: ${complexID}`);
      return;
    }

    // Always include complexCoordinates if available
    if (
      Array.isArray(fallbackCoord) &&
      fallbackCoord.length === 2 &&
      !coordsArray.find((c) => c[0] === fallbackCoord[0] && c[1] === fallbackCoord[1])
    ) {
      coordsArray.push(fallbackCoord);
    }

    let bounds;
    const paddingDegrees = getDynamicPadding(coordsArray, zoom);

    if (coordsArray.length >= 2) {
      bounds = coordsArray.reduce(
        (expand, coord) => expand.extend(coord),
        new mapboxgl.LngLatBounds(coordsArray[0], coordsArray[0])
      );

      // add a padding to the box created
      bounds.extend([
        bounds.getSouthWest().lng - paddingDegrees,
        bounds.getSouthWest().lat - paddingDegrees,
      ]);
      bounds.extend([
        bounds.getNorthEast().lng + paddingDegrees,
        bounds.getNorthEast().lat + paddingDegrees,
      ]);
    } else {
        const [lng, lat] = coordsArray[0];
        bounds = new mapboxgl.LngLatBounds(
          [lng - paddingDegrees, lat - paddingDegrees],
          [lng + paddingDegrees, lat + paddingDegrees]
        );
    }

    const corners = [
      [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
      [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
      [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
      [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
      [bounds.getNorthWest().lng, bounds.getNorthWest().lat], // close loop
    ];

    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [corners],
      },
      properties: {
        complexID,
      },
    });
  });

  return {
    type: "FeatureCollection",
    features,
  };
}
