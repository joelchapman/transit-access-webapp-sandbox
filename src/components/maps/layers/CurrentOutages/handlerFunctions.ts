import { 
  getOutageLayerFeatures, 
  getStationOutageLayerFeatures, 
  getComplexOutageLayerFeatures, 
  getUpcomingOutageLayerFeatures 
} from "@/utils/dataUtils";

export const getOutElevatorData = (elOutages: any[]) => {
  const outElevatorData = [];

  if (elOutages.length !== 0) {
    elOutages.forEach(
      (equip: {
        equipmenttype: string;
        isupcomingoutage: string;
        equipment: string;
        estimatedreturntoservice: string;
      }) => {
        if (equip.equipmenttype === "EL") {
          outElevatorData.push({
            elevatorNo: equip.equipment.trim(),
            estimatedreturntoservice: equip.estimatedreturntoservice?.trim() || null,
            isupcomingoutage: equip.isupcomingoutage,
          });
        }
      }
    );
  }

  return outElevatorData;
};

export const getUpcomingElevatorData = (elOutages: any[]) => {
  const upcomingOutElevatorData = [];

  if (elOutages.length !== 0) {
    elOutages.forEach(
      (equip: {
        equipmenttype: string;
        isupcomingoutage: string;
        equipment: string;
        estimatedreturntoservice: string;
        reason: string;
      }) => {
        if (equip.equipmenttype === "EL" && equip.isupcomingoutage === "Y") {
          upcomingOutElevatorData.push({
            elevatorNo: equip.equipment.trim(),
            estimatedReturn: equip.estimatedreturntoservice?.trim() || null,
          });
        }
      }
    );
  }
  return upcomingOutElevatorData;
};

export const updateOutageLayer = (data: any[], mapRef: { getSource: (arg0: string) => any; } ) => {

  const outageElevatorNos = getOutElevatorData(data);
  const features = getOutageLayerFeatures(outageElevatorNos);

  const geojsonSource = mapRef?.getSource("outage-data");
  geojsonSource?.setData({
    type: "FeatureCollection",
    features: features,
  });
};

export const updateStationOutageLayer = (
  stationOutageArray: string[],
  mapRef: { getSource: (arg0: string) => any; }
) => {

  const features = getStationOutageLayerFeatures(stationOutageArray);

  const geojson = {
    type: "FeatureCollection",
    features: features,
  };

  const geojsonSource = mapRef?.getSource("station-outage-data");
  if (geojsonSource) {
    geojsonSource.setData(geojson);
  } else {
    console.warn("station-outage-data source not found");
  }
};

export const updateStationComplexLayer = (
  stationOutageArray: string[],
  mapRef: { getSource: (arg0: string) => any; }
) => {

  const features = getComplexOutageLayerFeatures(stationOutageArray);

  const geojson = {
    type: "FeatureCollection",
    features: features,
  };

  const geojsonSource = mapRef?.getSource("station-complexes");
  if (geojsonSource) {
    geojsonSource.setData(geojson);
  } else {
    console.warn("station-complex-data source not found");
  }
};

export const updateUpcomingOutagesLayer = (
  upcomingOutageArray: string[],
  mapRef: { getSource: (arg0: string) => any; }
) => {

  const features = getUpcomingOutageLayerFeatures(upcomingOutageArray);

  const geojson = {
    type: "FeatureCollection",
    features: features,
  };

  const geojsonSource = mapRef?.getSource("upcoming-outage-data");
  if (geojsonSource) {
    geojsonSource.setData(geojson);
  } else {
    console.warn("upcoming-outage-data source not found");
  }
};