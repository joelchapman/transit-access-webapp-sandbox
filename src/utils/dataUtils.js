/* 
dataUtils is used to filter existing arrays and elevator data
*/

import mapboxgl from "mapbox-gl";
import area from "@turf/area";
import { elevatorCoordinates } from "./elevatorOutageGeometry";

import { stationCoordinates } from "./accessibleStationGeometry";
import { stationGeometry } from "./stationGeometry";
import { complexCoordinates } from "./ComplexGeometry";
import { getComplexBoundaryGeoJSON } from "@/components/MtaMap/layers/StationComplexes/complexBoundaries";
import { parse, isToday, isTomorrow, isThisWeek, format, formatDistanceToNow, formatDistance, differenceInDays } from "date-fns";

import { getElevatorsDataset, getComplexesDataset, getStationsDataset } from "@/lib/dataStore";

// Getter shims — existing function bodies read these as if they were the original JSON imports
const customElevatorDataset = { get features() { return getElevatorsDataset().features; } };
const complexesDataset = { get features() { return getComplexesDataset().features; } };
const stationsDataset = { get features() { return getStationsDataset().features; } };
import { setManhattanTilt } from "@/components/MtaMap/mtaMapOptions";
import { ROUTE_ORDER } from "./constants";
import { LineBullets } from "@/components/LineBullets/LineBullets";

import { elevatorHighlightProps, elevatorToComplexHighlightProps } from "@/components/MtaMap/layers/StationComplexes/elevatorHighlightsProps";

// make a map of elevator # tied to stationID and complexID
import {
  buildElevatorIndex,
  stationIDToComplexID,
} from "@/utils/elevatorIndexUtils";
let elevatorIndex = [];

// NYC's street grid makes actual walking ~30% longer than straight-line Haversine
export const WALKING_DISTANCE_FACTOR = 1.3;

// the walking distance users are expected to tolerate (in walking miles)
export const WALKING_TOLERANCE_MILES = 1;

// crow-flies equivalent of the walking tolerance
export const radiusTolerance = WALKING_TOLERANCE_MILES / WALKING_DISTANCE_FACTOR;

// Function to highlight all upcoming outages
export function getUpcomingOutages(outageArray) {
  const upcomingOutages = [];
  outageArray?.forEach((equip) => {
    if (equip.equipmenttype === "EL" && equip.isupcomingoutage === "Y") {
      const cleanElevatorNo = equip.equipment.trim(); // Trim spaces from elevator number

      let obj = {
        type: "Feature",
        id: cleanElevatorNo,
        properties: {
          station: equip.station,
          outagedate: equip.outagedate,
          returntoservice: equip.estimatedreturntoservice,
          elevatorno: cleanElevatorNo,
          isBroken: true,
        },
        geometry: elevatorCoordinates[cleanElevatorNo]
          ? {
              coordinates: elevatorCoordinates[cleanElevatorNo],
              type: "Point",
            }
          : null,
      };
      upcomingOutages.push(obj);
    }
  });
  return upcomingOutages;
}

export function getOutageLayerFeatures(outElevatorData) {
  const features = [];

  // Use customDataset.features array
  const elevatorsArray = Array.isArray(customElevatorDataset.features)
    ? customElevatorDataset.features
    : [];

  for (const [elevatorNo, geometry] of Object.entries(elevatorCoordinates)) {
    const cleanElevatorNo = elevatorNo.trim();

    // Find match in outage data
    const match = outElevatorData.find((e) => e.elevatorNo === cleanElevatorNo);

    // Find corresponding elevator in customDataset.features, accessing properties
    const elevatorFeature = elevatorsArray.find(
      (f) => f.properties?.elevatorno?.trim() === cleanElevatorNo
    );

    // Determine isStreet value
    const isStreet =
      elevatorFeature && elevatorFeature.properties?.isStreet
        ? elevatorFeature.properties.isStreet === "true" ||
          elevatorFeature.properties.isStreet === true
        : false;

    const obj = {
      type: "Feature",
      id: cleanElevatorNo,
      properties: {
        elevatorno: cleanElevatorNo,
        isBroken: Boolean(match),
        estimatedreturntoservice: match?.estimatedReturn || null,
        isStreet: isStreet,
      },
      geometry: geometry
        ? {
            coordinates: geometry,
            type: "Point",
          }
        : null,
    };

    features.push(obj);
  }
  return features;
}

export function getUpcomingOutageLayerFeatures(upcomingOutElevatorData) {
  if (!Array.isArray(upcomingOutElevatorData)) return [];
  const features = [];
  for (const elevator of upcomingOutElevatorData) {
    const cleanElevatorNo = elevator?.equipment.trim();
    const outageDate = elevator?.outagedate;
    const estimatedreturntoservice = elevator?.estimatedreturntoservice;
    const rawStationID = getStationIDByElevatorNo(cleanElevatorNo);

    const coordsList = rawStationID
      ?.split("/") // split into individual stations
      ?.map(id => id.replace(/^0+/, "")) // strip leading zeros
      ?.map(id => stationCoordinates[id]) // look up coords
      ?.filter(Boolean); // remove null/undefined
    const coords = coordsList ? coordsList[0] : null;

    // coordsList is an array of all matching station coordinates
    // to be cleaned with a smarter function linking elevators to stations, rather than complexes
    
    const station = stationsDataset.features.find((s) => {
      // Normalize both sides by removing leading zeros
      const datasetID = String(s.properties.station_id).replace(/^0+/, "");
      
      // Split incoming ID by "/" and normalize each piece
      const idsToMatch = rawStationID
        ?.split("/")
        ?.map(id => id.replace(/^0+/, ""));

      return idsToMatch?.includes(datasetID);
    });    

    const obj = {
      type: "Feature",
      id: cleanElevatorNo,
      properties: {
        elevatorno: cleanElevatorNo,
        outageDate: outageDate,
        estimatedreturntoservice: estimatedreturntoservice,
        station: station?.properties.stop_name,
        isUpcoming: true,
        reason: elevator.reason,
        outageDurationDays: getOutageDurationDays(outageDate, estimatedreturntoservice),
      },
      geometry: coords
        ? {
            coordinates: coords,
            type: "Point",
          }
        : null,
    };

    features.push(obj);
  }
  return features;
}

// The following functions make it easy to find an elevator attached to a given station
/* ************************************************************************** */
export function makeElevatorMap() {
  elevatorIndex = buildElevatorIndex(customElevatorDataset.features);
  return elevatorIndex;
}

export function getElevatorByNo(elevatorNo) {
  return elevatorIndex?.elevatorByNo?.get(elevatorNo);
}

export function getElevatorsByComplexId(complexId) {
  return elevatorIndex?.elevatorByComplexId?.get(complexId) || [];
}

export function getElevatorsByStationId(stationId) {
  return elevatorIndex?.elevatorByStationId?.get(stationId) || [];
}

export function getComplexIDByElevatorNo(elevatorNo) {
  return elevatorIndex?.elevatorByNo?.get(elevatorNo)?.properties?.complexID;
}

export function getStationIDByElevatorNo(elevatorNo) {
  return elevatorIndex?.elevatorByNo?.get(elevatorNo)?.properties?.stationID;
}

/* ************************************************************************** */

export function easyToReadDate(outageDate) {
  const parsedDate = parse(outageDate, "MM/dd/yyyy hh:mm:ss a", new Date());
  return `${format(parsedDate, "EEEE',' MMMM dd 'at' h:mmaaa")}`;
}

export function convertDate(outageDate) {
  const parsedDate = parse(outageDate, "MM/dd/yyyy hh:mm:ss a", new Date());

  if (isToday(parsedDate)) {
    return `in ${formatDistanceToNow(parsedDate)} (${format(parsedDate, "h:mmaaa")})`;
  }

  if (isTomorrow(parsedDate)) {
    return `Tomorrow at ${format(parsedDate, "h:mmaaa")}`;
  }

  if (isThisWeek(parsedDate)) {
    return `This ${format(parsedDate, "EEEE 'at' h:mmaaa")}`;
  }

  // fallback: generic relative time
  return `in ${formatDistanceToNow(parsedDate)}`;
}

export function convertDateDistance(outageDate, estimatedReturn) {
  const parsedDate = parse(outageDate, "MM/dd/yyyy hh:mm:ss a", new Date());
  const parsedReturn = parse(estimatedReturn, "MM/dd/yyyy hh:mm:ss a", new Date());

  if (isToday(parsedDate)) {
    return `Today at ${format(parsedDate, "h:mmaaa")} for ${formatDistance(outageDate, estimatedReturn)}`;
  }

  if (isTomorrow(parsedDate)) {
    return `Tomorrow at ${format(parsedDate, "h:mmaaa")} for ${formatDistance(outageDate, estimatedReturn)}`;
  }

  if (isThisWeek(parsedDate)) {
    return `This ${format(parsedDate, "EEEE 'at' h:mmaaa")} for ${formatDistance(outageDate, estimatedReturn)}`;
  }

  // fallback: generic relative time
  return `In ${formatDistanceToNow(parsedDate)}`;
}

// Returns "tonight" (start >= 6pm today), "today" (any other time today),
// "overnight" (start < 6am tomorrow), "tomorrow" (any other time tomorrow), or null.
// Outages whose scheduled start time has already passed are ignored, since the
// MTA feed sometimes leaves stale entries in "upcoming" past their start time.
function maintenanceTodayLabel(outageStrings) {
  const rank = { tonight: 4, overnight: 3, today: 2, tomorrow: 1 };
  const now = new Date();
  let label = null;
  for (const dateStr of outageStrings) {
    const parsed = parse(dateStr, "MM/dd/yyyy hh:mm:ss a", new Date());
    if (parsed < now) continue;

    let candidate = null;
    if (isToday(parsed)) {
      candidate = parsed.getHours() >= 18 ? "tonight" : "today";
    } else if (isTomorrow(parsed)) {
      candidate = parsed.getHours() < 6 ? "overnight" : "tomorrow";
    }
    if (candidate && (label === null || rank[candidate] > rank[label])) {
      label = candidate;
    }
  }
  return label;
}

export function getElevatorMaintenanceToday(elevatorno, upcomingElevatorData) {
  if (!upcomingElevatorData || !elevatorno) return null;
  const dates = upcomingElevatorData
    .filter((u) => u.equipment?.trim().toLowerCase() === elevatorno.trim().toLowerCase())
    .map((u) => u.outagedate);
  return maintenanceTodayLabel(dates);
}

// An elevator can have more than one upcoming-outage record at once (e.g. a short one
// tomorrow and a longer one months out) — picking the soonest one, rather than whichever
// happens to come first in the feed, keeps it the same record getElevatorMaintenanceToday's
// label describes, so the badge and the detail text never disagree.
export function getSoonestUpcomingOutage(elevatorno, upcomingElevatorData) {
  if (!upcomingElevatorData || !elevatorno) return null;
  const matches = upcomingElevatorData.filter(
    (u) => u.equipment?.trim().toLowerCase() === elevatorno.trim().toLowerCase(),
  );
  if (matches.length === 0) return null;
  return matches.reduce((soonest, u) => {
    const date = parse(u.outagedate, "MM/dd/yyyy hh:mm:ss a", new Date());
    const soonestDate = parse(soonest.outagedate, "MM/dd/yyyy hh:mm:ss a", new Date());
    return date < soonestDate ? u : soonest;
  });
}

export function getComplexMaintenanceToday(complexId, upcomingElevatorData) {
  if (!upcomingElevatorData) return null;
  const elevators = getElevatorsByComplexId(complexId);
  const complexElevNos = new Set(
    elevators.map((el) => el.properties.elevatorno?.trim().toLowerCase())
  );
  const dates = upcomingElevatorData
    .filter((u) => u.equipmenttype === "EL" && complexElevNos.has(u.equipment?.trim().toLowerCase()))
    .map((u) => u.outagedate);
  return maintenanceTodayLabel(dates);
}

// Great-circle (haversine) distance between two points, in miles
export function distanceMiles(lng1, lat1, lng2, lat2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function walkingDistanceMiles(lng1, lat1, lng2, lat2) {
  return distanceMiles(lng1, lat1, lng2, lat2) * WALKING_DISTANCE_FACTOR;
}

export function getNearbyStations(userLng, userLat, radiusMiles = radiusTolerance) {
  if (!stationsDataset.features) return [];
  return stationsDataset.features
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      return { ...f, distance: distanceMiles(userLng, userLat, lng, lat) };
    })
    .filter((f) => f.distance <= radiusMiles && f.properties.ada !== "0")
    .sort((a, b) => a.distance - b.distance);
}

export function getNearbyComplexes(userLng, userLat, radiusMiles = radiusTolerance) {
  if (!complexesDataset.features) return [];
  return complexesDataset.features
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const distance = distanceMiles(userLng, userLat, lng, lat);
      const stationIDs = (f.properties.station_ids || "")
        .split("/")
        .map((id) => id.trim())
        .filter(Boolean);
      const route = concatenateRoutes(stationIDs, stationsDataset);
      // a station_id can have more than one physical stop (e.g. Queensboro
      // Plaza, 145 St, W 4 St-Wash Sq), so every matching row needs to be
      // included, not just the first one .find() would return.
      const ada_notes = stationIDs
        .flatMap((stationID) => {
          const stations = stationsDataset.features.filter(
            (s) => s.properties.station_id === stationID,
          );
          return stations.map((station) => {
            if (!station.properties.ada_notes || station.properties.ada_notes === "NaN") return null;
            let routes = "";
            if (stationIDs.length > 1 || stations.length > 1) routes = station.properties.daytime_routes || "";
            return `${routes} ${station.properties.ada_notes.trim()}`.trim();
          });
        })
        .filter(Boolean)
        .join(", ");
      return { ...f, distance, properties: { ...f.properties, route, ada_notes } };
    })
    .filter((f) => f.distance <= radiusMiles && f.properties.ada !== "0")
    .sort((a, b) => a.distance - b.distance);
}

function parseOutageDate(dateStr) {
  if (!dateStr) return null;
  const ref = new Date();
  const parsed12Hour = parse(dateStr, "MM/dd/yyyy hh:mm:ss a", ref);
  if (!isNaN(parsed12Hour.getTime())) return parsed12Hour;
  const parsed24Hour = parse(dateStr, "MM/dd/yyyy HH:mm:ss", ref);
  if (!isNaN(parsed24Hour.getTime())) return parsed24Hour;
  return null;
}

export function getOutageDurationDays(outagedate, estimatedreturntoservice) {
  const start = parseOutageDate(outagedate);
  const end = parseOutageDate(estimatedreturntoservice);
  if (!start || !end) return NaN;
  return differenceInDays(end, start);
}

export const getADAPctByStation = () => {
  const adaScore = { 0: 0, 1: 1, 2: 0.5 };

  const stations = stationsDataset.features.map((f) => f.properties);

  let totalScore = 0;
  let maxScore = stations.length;

  for (const s of stations) {
    const val = String(s.ada ?? "0");
    totalScore += adaScore[val] ?? 0;
  }

  const pct = Math.round((totalScore / maxScore) * 100); ;

  // console.log(`Total stations:       ${maxScore}`);
  // console.log(`Weighted ADA score:   ${totalScore}`);
  // console.log(`ADA accessibility:    ${pct}%`);

  // Breakdown by category
  const counts = { 0: 0, 1: 0, 2: 0 };
  for (const s of stations) counts[String(s.ada ?? "0")]++;

  // console.log(`\nBreakdown:`);
  // console.log(`${counts["1"]} fully ADA, ${counts["2"]} half ADA, ${counts["0"]} not ADA`);

  return pct;
}


export const getADAPctByComplex = () => {
  const adaScore = { 0: 0, 1: 1, 2: 0.5 };

  const stations = stationsDataset.features.map((f) => f.properties);

  // Group stations by complex_id
  const complexMap = new Map();
  for (const s of stations) {
    const id = s.complex_id ?? s.station_id;
    if (!complexMap.has(id)) complexMap.set(id, []);
    complexMap.get(id).push(Number(s.ada ?? 0));
  }

  // Each complex contributes (sum of station scores) / (number of stations in complex)
  let totalScore = 0;
  const maxScore = complexMap.size;
  for (const stationVals of complexMap.values()) {
    const complexScore = stationVals.reduce((sum, val) => sum + (adaScore[val] ?? 0), 0);
    totalScore += complexScore / stationVals.length;
  }

  const pct = Math.round((totalScore / maxScore) * 100);  // 0 decimals

  // console.log(`Total complexes:      ${maxScore}`);
  // console.log(`Weighted ADA score:   ${totalScore.toFixed(2)}`);
  // console.log(`ADA accessibility:    ${pct}%`);

  return pct;
}

export const getCurrentElevatorCount = () => {
  const currentElevatorCount = customElevatorDataset.features.length;
  return currentElevatorCount;
}


// when going between stations and complexes, the complex has to inherit a concatenated version of routes and ADA
export function concatenateRoutes(stationIDs, stationsDataset) {
  const routes = new Set();

  for (const stationID of stationIDs) {
    for (const station of stationsDataset.features) {
      const props = station.properties;
      if (props?.station_id === stationID && props?.ada !== "0") {
        const routeStr = props.daytime_routes || "";
        routeStr.split(" ").forEach((r) => {
          const route = r.trim();
          if (route) routes.add(route);
        });
      }
    }
  }

  return Array.from(routes)
  .sort((a, b) => ROUTE_ORDER.indexOf(a) - ROUTE_ORDER.indexOf(b))
  .join(" ");
}

export function concatenateInaccessibleRoutes(stationIDs, stationsDataset) {
  const routes = new Set();

  for (const stationID of stationIDs) {
    for (const station of stationsDataset.features) {
      const props = station.properties;
      if (props?.station_id === stationID && props?.ada == "0") {
        const routeStr = props.daytime_routes || "";
        routeStr.split(" ").forEach((r) => {
          const route = r.trim();
          if (route) routes.add(route);
        });
      }
    }
  }

  return Array.from(routes)
    .sort((a, b) => ROUTE_ORDER.indexOf(a) - ROUTE_ORDER.indexOf(b))
    .join(" ");
}

// when going between stations and complexes, the complex has to inherit a concatenated version of routes and ADA
export function concatenateADA(stationIDs, stationsDataset) {
  const adaSet = new Set();

  for (const stationID of stationIDs) {
    const stationMatches = stationsDataset.features.filter(
      (s) => s.properties?.station_id === stationID
    );

    for (const station of stationMatches) {
      const adaValue = String(station.properties?.ada ?? "0");
      adaSet.add(adaValue);
    }
  }

  if (adaSet.size === 1) {
    return Array.from(adaSet)[0]; // all same value
  }

  return "2"; // mixed accessibility = partially accessible
}

export function getComplexOutageLayerFeatures(outStationArray) {
  const features = [];
  const stationOutageMap = new Map();

  // Map all station outages for quick lookup
  for (const station of outStationArray) {
    stationOutageMap.set(station.stationID, {
      isOut: station.isOut || false,
      isProblem: station.isProblem || false,
    });
  }

  for (const complex of complexesDataset.features) {
    const complexID = complex.properties?.complex_id;
    const stop_name = complex.properties?.stop_name || "Unknown";
    const stationIDsRaw = complex.properties?.station_ids || "";
    const stationIDs = stationIDsRaw.split("/").map((id) => id.trim());

    // Get only ADA stations in this complex. complexes dataset lists all stations in complex
    const adaStationIDs = stationIDs.filter((id) => {
      const station = stationsDataset.features.find(
        (s) => s.properties.station_id === id
      );

      return station && String(station.properties.ada) !== "0";
    });

    const totalAdaStations = adaStationIDs.length;
    const totalStations = stationIDs.length;

    const geometry = complexCoordinates[complexID];
    if (!geometry) {
      console.warn(`Missing complex geometry for complexID ${complexID}`);
      continue;
    }

    const ada = concatenateADA(stationIDs, stationsDataset);
    const route = concatenateRoutes(stationIDs, stationsDataset);

    // Count outage status only for ADA stations
    let outCount = 0;
    let hasProblemStation = false;

    // use const stationID of adaStationIDs for outage calculating ADA only
    for (const stationID of stationIDs) {
      const outage = stationOutageMap.get(stationID) || {
        isOut: false,
        isProblem: false,
      };

      if (outage.isOut) outCount++;
      if (outage.isProblem) hasProblemStation = true;
    }
    // change totalStations to totalAdaStations for ADA only calc
    const isOut = outCount === totalStations && totalStations > 0;
    const isProblem = isOut || hasProblemStation || outCount > 0; // Partial ADA outage/problem

    features.push({
      type: "Feature",
      id: complexID,
      properties: {
        ada,
        route,
        stop_name,
        station_ids: stationIDsRaw,
        isProblem,
        isOut,
        complex_id: complexID,
      },
      geometry: {
        type: "Point",
        coordinates: geometry,
      },
    });
  }

  return features;
}

export function getStationOutageLayerFeatures(outStationArray) {
  const features = [];

  const stationIdToPropertiesMap = new Map();

  for (const feature of stationsDataset.features) {
    const stationIDs = String(feature.properties.station_id || "")
      .split("/")
      .map((s) => s.trim());

    for (const id of stationIDs) {
      stationIdToPropertiesMap.set(id, {
        complexID: feature.properties.complex_id,
        ada: feature.properties.ada,
      });
    }
  }

  for (const stationNo of Object.keys(stationCoordinates)) {
    const cleanStationNo = stationNo.trim();
    const baseGeometry = stationCoordinates[stationNo];

    // include complexID so later flyIn can easily reference stations and complexes
    // include ada because outage layer does not have it
    const props = stationIdToPropertiesMap.get(cleanStationNo);
    const complexID = props?.complexID;
    const ada = props?.ada;

    const geometry = baseGeometry;

    // Check to match OOS station numbers with their coordinates
    const outageData = outStationArray.find(
      (station) => station.stationID?.trim?.() === cleanStationNo
    );

    const isProblem = outageData?.isProblem || false;
    const isOut = outageData?.isOut || false;

    features.push({
      type: "Feature",
      id: cleanStationNo,
      properties: {
        ada,
        station_id: cleanStationNo,
        isProblem,
        isOut,
        complex_id: complexID || null,
      },
      geometry: {
        type: "Point",
        coordinates: geometry,
      },
    });
  }
  return features;
}

export const getStationsWithOutages = (elevatorOutages) => {
  if (!elevatorOutages || elevatorOutages.length === 0) {
    console.warn("No elevator outages available.");
    return {};
  }

  const elevatorFeatures = Array.isArray(customElevatorDataset.features)
    ? customElevatorDataset.features
    : [];

  if (!elevatorFeatures || elevatorFeatures.length === 0) {
    console.warn("customDataset is empty or invalid.");
    return {};
  }

  const stationsWithOutages = {};
  const complexMap = {};

  // Build a map keeping track of stationIDs and their complexes
  complexesDataset.features.forEach((feature) => {
    const complexID = feature.properties?.complex_id;
    const stationIDs = String(feature.properties?.station_ids || "").split("/");

    if (complexID) {
      if (!complexMap[complexID]) complexMap[complexID] = new Set();
      stationIDs.forEach((id) => id.trim() && complexMap[complexID].add(id.trim()));
    }
  });

  // Also fold in stationIDs found directly on elevator records, in case one
  // references a station not listed under its complex.
  elevatorFeatures.forEach((feature) => {
    const complexID = feature.properties?.complexID;
    const stationIDs = String(feature.properties?.stationID || "").split("/");

    if (complexID) {
      // add complex if it's not there yet
      if (!complexMap[complexID]) complexMap[complexID] = new Set();
      stationIDs.forEach((id) => id.trim() && complexMap[complexID].add(id.trim()));
    }
  });

  // Track outages. Ignore escalators and upcoming outages
  elevatorOutages.forEach((elevator) => {
    if (elevator.equipmenttype !== "EL" || elevator.isupcomingoutage !== "N")
      return;

    // find the elevator in the custom dataset
    const affectedFeature = elevatorFeatures.find(
      (f) => f.properties?.elevatorno?.trim() === elevator.equipment?.trim()
    );

    if (!affectedFeature) return;

    const complexID = affectedFeature.properties?.complexID;
    const stationIDs =
      String(affectedFeature.properties?.stationID)?.split("/") || [];
    const isStreetElevator = affectedFeature.properties?.isStreet;

    let affectedStations = [];

    // if a street elevator is OOS, it impacts the whole complex, so each station needs to know there isProblem
    if (isStreetElevator && complexID && complexMap[complexID]) {
      affectedStations = Array.from(complexMap[complexID]);
    } else {
      affectedStations = stationIDs.map((s) => s.trim());
    }

    affectedStations.forEach((stationID) => {
      if (!stationsWithOutages[stationID]) {
        stationsWithOutages[stationID] = {
          isProblem: true,
          isOut: false,
          count: 0,
        };
      }
      stationsWithOutages[stationID].count += 1;
    });
  });

  // Now determine if entire station is out
  Object.entries(stationsWithOutages).forEach(([stationID, status]) => {
    const totalElevators = elevatorFeatures.filter((f) =>
      String(f.properties?.stationID || "")
        .split("/")
        .map((s) => s.trim())
        .includes(stationID)
    ).length;

    stationsWithOutages[stationID].isOut = status.count >= totalElevators;
    delete stationsWithOutages[stationID].count;
  });

  return stationsWithOutages;
};

export const getStationOutageArray = (elevatorOutages) => {
  const stationsMap = getStationsWithOutages(elevatorOutages);

  return Object.entries(stationsMap)
    .filter(([_, data]) => data.isProblem)
    .map(([stationID, data]) => {
      const trimmedID = stationID.trim?.();

      // Find corresponding ADA info in the custom dataset
      const adaStatus = customElevatorDataset.features.find((f) =>
        String(f.properties?.stationID || "")
          .split("/")
          .map((s) => s.trim())
          .includes(trimmedID)
      )?.properties?.ada;

      return {
        stationID: trimmedID,
        ada: adaStatus ?? null, // fallback to null if not found
        ...data,
      };
    });
};

export function adjustCenter3D(map, [lng, lat], offsetPixels) {
  if (!map || typeof map.project !== "function") return [lng, lat];

  const projected = map.project([lng, lat]);

  const pitch = map.getPitch();
  // offsetPixels = 250 + pitch * 2; // e.g. at 60° → 370px

  const adjustedPoint = new mapboxgl.Point(
    projected.x,
    projected.y - offsetPixels
  );
  const unprojected = map.unproject(adjustedPoint);

  // prevent invalid coordinates (this was a problem with pitch !==0)
  if (
    !unprojected ||
    isNaN(unprojected.lng) ||
    isNaN(unprojected.lat) ||
    Math.abs(unprojected.lat) > 90 ||
    Math.abs(unprojected.lng) > 180
  ) {
    console.warn("adjustCenter3D returned invalid coordinates", unprojected);
    return [lng, lat]; // Fallback to original
  }

  return [unprojected.lng, unprojected.lat];
}

export function adjustCenter(map, [lng, lat], popupHeightPx = 300) {
  const point = map.project([lng, lat]);
  point.y -= popupHeightPx;
  return map.unproject(point);
}

export function getAverageElevatorCoordinates(datasetArray, complexID) {
  const bounds = new mapboxgl.LngLatBounds();

  let totalLng = 0;
  let totalLat = 0;
  let validCount = 0;

  datasetArray.forEach((item) => {
    const isStreet = item.properties?.isStreet;
    const itemComplexID = item.properties?.complexID;

    if (isStreet && itemComplexID === complexID) {
      const coords = item.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const [lng, lat] = coords;
        totalLng += lng;
        totalLat += lat;
        bounds.extend([lng, lat]);
        validCount++;
      }
    }
  });

  const complexCoord = complexCoordinates[complexID];
  if (Array.isArray(complexCoord) && complexCoord.length === 2) {
    bounds.extend(complexCoord);
  }

  if (validCount === 0 && !complexCoord) {
    console.warn(
      "No valid street elevators or complex coordinate for:",
      complexID
    );
    return null;
  }

  const average =
    validCount > 0
      ? [totalLng / validCount, totalLat / validCount]
      : complexCoord;

  return { average, bounds };
}

export function getAreaOfComplex(complexID, map, showBoundary, referenceZoom) {
  const zoomLevel = referenceZoom ?? map.getZoom();
  const boundaryData = getComplexBoundaryGeoJSON(zoomLevel);
  const feature = boundaryData.features.find(
    (f) => f.properties.complexID === complexID
  );

  if (showBoundary) {
    if (feature) {
      showActiveComplexBoundary(feature, map)
    } else {
      console.warn("No boundary found for complexID", complexID);
    }
    
  }
  if (feature) {
    return area(feature); // returns area in square meters
  }

  return null;
}

export function showActiveComplexBoundary(feature, map) {
    map.getSource("active-complex-boundary").setData({
      type: "FeatureCollection",
      features: [feature],
    });

  // visual properties
  map.setLayoutProperty(
    "active-complex-boundary-layer",
    "visibility",
    "visible"
  );
  // Reset opacity to full
  map.setPaintProperty("active-complex-boundary-layer", "fill-opacity", 0.4);

  // Gradually fade out over ~3 seconds
  const fadeDuration = 3000;
  const steps = 30;
  let step = 0;

  const interval = setInterval(() => {
    step++;
    const opacity = 0.3 * (1 - step / steps);
    map.setPaintProperty(
      "active-complex-boundary-layer",
      "fill-opacity",
      opacity
    );

    if (step >= steps) {
      clearInterval(interval);
      // Optional: hide the layer after fade
      map.setLayoutProperty(
        "active-complex-boundary-layer",
        "visibility",
        "none"
      );
    }
  }, fadeDuration / steps);
}

function extendBoundsForPopup(bounds, popupDirection = "down") {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const latSpan = ne.lat - sw.lat;
  const lngSpan = ne.lng - sw.lng;

  let newSW = sw;
  let newNE = ne;

  const POPUP_OFFSET_PERCENT = 0.3;

  if (popupDirection === "down") {
    newSW = new mapboxgl.LngLat(
      sw.lng,
      sw.lat - latSpan * POPUP_OFFSET_PERCENT
    );
  } else if (popupDirection === "up") {
    newNE = new mapboxgl.LngLat(
      ne.lng,
      ne.lat + latSpan * POPUP_OFFSET_PERCENT
    );
  }

  // Stretch bounds if vertical spread is too small (e.g. for tiny lat span)
  const MIN_LAT_SPAN = 0.0004;
  if (latSpan < MIN_LAT_SPAN) {
    const padding = (MIN_LAT_SPAN - latSpan) / 2;
    newSW = new mapboxgl.LngLat(newSW.lng, newSW.lat - padding);
    newNE = new mapboxgl.LngLat(newNE.lng, newNE.lat + padding);
  }

  return new mapboxgl.LngLatBounds(newSW, newNE);
}

export function flyIn(
  map,
  station_ids,
  complex_id,
  coordsOrBounds,
  isAccessible,
  isPopup = false,
  stationView,
  setStationView
) {
  
  const zoomBoundsDuration = 900; // speed that we fly into an accessible station
  const MID_AREA = 4000; // in meters, area at which we need to zoom in a little to comfortably see station
  const MIN_AREA = 2000; // in meters, area at which we need to zoom in even more to comfortably see station
  const MAX_LAT_SPAN = 0.002; // to accommodate the Times Square/Port Authority sprawl for small screens
  let maxZoomLevel = 17;

  const stationFeature = stationsDataset.features.find ((s) => s.properties.station_id === station_ids[0]);
  const borough = stationFeature.properties.borough;


  if (!coordsOrBounds) {
    console.warn("flyIn: No coordinates or bounds provided.");
    return;
  }

  if (isAccessible === false) {
    // Inaccessible → simple flyTo
    if (!Array.isArray(coordsOrBounds)) {
      console.warn("flyIn: Invalid coordinate array for inaccessible station");
      return;
    }

    map.flyTo({
      center: coordsOrBounds,
      zoom: map.getZoom(),
      pitch: 0,
      bearing: borough == "M"? setManhattanTilt(): 0,
      speed: 0.8,
      offset: [window.innerWidth >= 768 ? 90 : 0, 0], // shift a little right on desktop to accommodate popup
    });
    return;
  }

  if (coordsOrBounds instanceof mapboxgl.LngLatBounds) {
    const currentLatSpan =
      coordsOrBounds.getNorthEast().lat - coordsOrBounds.getSouthWest().lat;

    let adjustedBounds = coordsOrBounds;

    if (isPopup && currentLatSpan <= MAX_LAT_SPAN) {
      // extend for popup visibility and vertical spread
      adjustedBounds = extendBoundsForPopup(coordsOrBounds, "down");
    }
    // Extra bottom clearance for the middle snap state's sheet — mobile only.
    // Desktop shows the same view in a left-side panel, which doesn't cover the
    // bottom of the screen, so it keeps the original clearance.
    const isDesktop = window.innerWidth >= 768;
    const dynamicPadding =
      currentLatSpan > 0.0008
        ? { top: 100, bottom: isDesktop ? 200 : 420, left: 0, right: 0 }
        : { top: 80, bottom: isDesktop ? 220 : 340, left: 30, right: 30 };

    const area = getAreaOfComplex(complex_id, map, false, 15); // fixed zoom so area is consistent regardless of current zoom (prevents double-tap drift)

    // fit bounds almost does the job, but we still need to adjust the zoom a little higher for small stations
    if (area > MIN_AREA && area < MID_AREA) {
      maxZoomLevel += 1;
    }

    if (area < MIN_AREA) { 
      maxZoomLevel += 2; 
    }

    map.fitBounds(adjustedBounds, {
      padding: dynamicPadding,
      offset: [window.innerWidth >= 768 ? 90 : 0, -map.getCanvas().height * 0.01], // shift a little right on desktop to accommodate popup
      maxZoom: maxZoomLevel,
      pitch: 0,
      bearing: borough == "M"? setManhattanTilt(): 0,
      duration: zoomBoundsDuration,
    });

    return;
  }

  console.warn("flyIn: Invalid bounds format for accessible station");
}

// Handles overlapping icons. A thoroghly annoying function needed for overlapping STATIONS (not complexes)
// Exception: if the user clicked on text from a
// *different* station than the highest-priority icon, the text wins
export function pickTopFeature(features, priority, lngLat) {
  const sorted = [...features].sort((a, b) => {
    const aPriority = priority.indexOf(a.layer.id);
    const bPriority = priority.indexOf(b.layer.id);
    if (aPriority !== bPriority) return aPriority - bPriority;
    const distA = Math.hypot(
      (a.geometry?.coordinates?.[0] ?? 0) - lngLat.lng,
      (a.geometry?.coordinates?.[1] ?? 0) - lngLat.lat,
    );
    const distB = Math.hypot(
      (b.geometry?.coordinates?.[0] ?? 0) - lngLat.lng,
      (b.geometry?.coordinates?.[1] ?? 0) - lngLat.lat,
    );
    return distA - distB;
  });

  const top = sorted[0];

  // prioritize the text — the user clicked on a visible label and not necessarily
  // the closest point to the station
  const iconLayers = new Set(["stationOutages", "stationDots"]);
  if (top && iconLayers.has(top.layer.id)) {
    const textFeature = sorted.find(
      (f) =>
        f.layer.id === "mta-subway-stations-accessible" &&
        f.properties?.station_id !== top.properties?.station_id,
    );
    if (textFeature) return textFeature;
  }

  return top;
}

/* A thoroughly annoying function to need for COMPLEXES, which solves accidentally clicking on
hidden mapbox text instead of the icon you actually clicked on */
export function dealWithMapboxIconOverlap(e) {
  if (!e.features || e.features.length === 0) return e;

  // Filter out invisible or empty-name features
  const filteredFeatures = e.features.filter((f) => {
    const text = f.properties?.name || "";
    const opacity = f.layer?.layout?.["text-opacity"];
    return text.trim() !== "" && (opacity === undefined || opacity > 0);
  });

  // dev warning, just in case it's helpful
  if (filteredFeatures.length > 1) {
    console.warn("Multiple overlapping features detected. Picking closest.");
  }

  if (filteredFeatures.length === 0) return e;

  // Find the closest actual geometry to the click point
  const clickedFeature = filteredFeatures.reduce((closest, current) => {
    const distance = Math.hypot(
      current.geometry.coordinates[0] - e.lngLat.lng,
      current.geometry.coordinates[1] - e.lngLat.lat
    );
    if (!closest) return { feature: current, distance };
    return distance < closest.distance
      ? { feature: current, distance }
      : closest;
  }, null)?.feature;

  if (!clickedFeature) return e;

  // Return a new event-like object with only the closest feature
  return {
    ...e,
    features: [clickedFeature],
  };
}

/**
 * Flies to a subway complex, optionally orienting toward an elevator.

 */

export function lookAtElevator(
  map,
  elevatorNo,
  elevatorCoords,
  prevElevatorNo,
  setElevatorView
) {
  if (!map || typeof map.flyTo !== "function") return;

  setElevatorView(elevatorNo);

  const MAX_DISTANCE = 0.0007; // max distance an elevator can be from a complex before changing zoom/pitch
  const complexID = getComplexIDByElevatorNo(elevatorNo);
  const complexCoords = complexCoordinates[complexID];
  let baseZoom = 19;
  let pitch = 60;
  let bearing = 0;

  if (elevatorCoords) {
    const deltaLng = elevatorCoords[0] - complexCoords[0];
    const deltaLat = elevatorCoords[1] - complexCoords[1];

    if (Math.abs(deltaLng) > MAX_DISTANCE || Math.abs(deltaLat) > MAX_DISTANCE) {
      baseZoom = 17.1;
      pitch = 65;
    }

    // Calculate new target bearing
    bearing = (Math.atan2(deltaLng, deltaLat) * 180) / Math.PI;
  }

  const adjustedCenter = adjustCenter3D(
    map,
    [complexCoords[0], complexCoords[1]],
    0
  );

  // Compare current bearing to target bearing
  const currentBearing = map.getBearing();
  const bearingDiff = Math.abs(((bearing - currentBearing + 180) % 360) - 180); // Normalize to [0, 180]

  const useFly = bearingDiff > 10; // Use fly if turning more than 10 degrees

  const method = useFly ? map.flyTo : map.easeTo;

  method.call(map, {
    center: adjustedCenter,
    zoom: baseZoom,
    bearing,
    pitch,
    speed: 1.2,
    curve: 1.5,
    essential: true,
  });
};

export function highlightElevator(map, activeFlyButton) {
  if (!map || typeof map.getLayer !== 'function' || map._removed) {
    return;
  }

    // Check if we have a valid elevator ID
    const elevatorId = activeFlyButton;

  // Remove existing highlight layers
  if (map.getLayer("elevator-complex-highlight")) {
    map.removeLayer("elevator-complex-highlight");
  }

  if (map.getLayer("elevator-highlight")) {
    map.removeLayer("elevator-highlight");
  }
  
  if (elevatorId === undefined || elevatorId === null) {
    return; 
  }

  // Add new highlight layers
  if (map.getLayer("elevator-to-complex-connectors")) {
    map.addLayer(elevatorToComplexHighlightProps(elevatorId));
  }

  if (map.getLayer("transit-elevators")) {
    map.addLayer(elevatorHighlightProps(elevatorId));
  }
}

export const generateSubwayLines = (
  routeLines,
  size,
  ada,
  isTitle,
  styles
) => {
  if (!routeLines) return null;

  const lines = routeLines.split(" ").filter(Boolean);
  const linesText = lines.join(", ");

  return (
    <>
      <span className="sr-only">
        {ada === "0"
          ? `${isTitle ? "Inaccessible subway lines:" : ""} ${linesText} ${isTitle ? "not A.D.A. accessible" : ""}`
          : `${isTitle ? "Accessible subway lines:" : ""} ${linesText}`}
      </span>
      {/* Screen reader only text, leave for future version */}
      {/* <span className="sr-only">
        {accessibilityLabel}
      </span> */}

      {/* Visual icons hidden from screen readers */}
      <LineBullets routes={lines} size={size === "big" ? "lg" : "sm"} />
    </>
  );
};