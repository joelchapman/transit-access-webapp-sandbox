import { FeatureCollection, Feature, Point } from "geojson";

export type UpcomingOutage = {
  reason?: string | null;
  outageDate?: string | null;
  estimatedReturn?: string | null;
  outageDuration?: string | null;
  outageDurationDays?: number | null;
};

export type ElevatorPopupProps = {
  title: string;
  ada?: string;
  directionLabel: string;
  elevatorno: string;
  description_custom?: string;
  shortdescription?: string;
  imageURL?: string;
  linesServed?: string;
  isOut?: boolean | string;
  isStreet?: boolean | string;
  estimatedreturntoservice?: string | null;
  totalElevators?: number;
  coordinates?: [number, number];
  access_note?: string;
  isBridge?: boolean | string;
  isMezzTransferOnly?: string;
  isRedundant?: boolean | string;
  isUpcomingOutage?: UpcomingOutage[] | null;
  maintenanceLabel?: string | null;
  lastUpdated?: Date | string | null;
};

export type StationPopupProps = {
  ada: string;
  ada_notes?: string | null;
  route?: string | null;
  inaccessibleRoutes?: string | null;
  complexName: string;
  complexID?: string | number;
  elevators: ElevatorPopupProps[];
  totalElevators: number;
  totalRamps: number;
  map?: mapboxgl.Map | null;
  stationView: string | null;
  setStationView: React.Dispatch<React.SetStateAction<string | null>>;
  elevatorView: string | null;
  setElevatorView: React.Dispatch<React.SetStateAction<string | null>>;
  show3DToggle: boolean;
  setShow3DToggle: React.Dispatch<React.SetStateAction<boolean>>;
  lastUpdated?: Date | string | null;
  isOut?: boolean | string;
  isProblem?: boolean | string;
  complexAlert?: string[];
  onBack?: () => void;
  userLocation?: [number, number] | null;
  walkingToleranceMiles?: number | null;
};

type ElevatorFeature = {
  type: string;
  properties: {
    isRedundant: string | undefined;
    stationAbbr: string | undefined;
    route: string | undefined;
    complexID: string | undefined;
    indiegogo: string | undefined;
    stationID: string | undefined;
    system: string | undefined;
    elevatorno: string | undefined;
    linesServed: string | undefined;
    directionLabel: string | undefined;
    title: string | undefined;
    image: string | undefined;
    alternativeRoute?: string | undefined;
    description: string | undefined;
    ada: string | undefined;
    isOverpass: string | undefined;
    isBroken: string | undefined;
    [key: string]: any;
  };
  geometry: {
    coordinates: [number, number] | any; // Tuple with two numbers
    type: string | undefined;
  };
  id: string | undefined;
};

type ElevatorData = {
  features: ElevatorFeature[];
};

export interface MtaStationProperties {
  station_id: string;
  complex_id: string;
  stop_name: string;
  line: string;
  daytime_routes: string;
  division: string;
  structure: string;
  ada: string;
  ada_notes: string | null;
  ada_northbound: string;
  ada_southbound: string;
  north_direction_label: string;
  south_direction_label: string;
  gtfs_stop_id: string;
  gtfs_longitude: string;
  gtfs_latitude: string;
  cbd: string;
  borough: string;
}; 

export type MtaStationFeature = Feature<Point, MtaStationProperties>;

export type MtaStationData = FeatureCollection<Point, MtaStationProperties>;

export interface Borough {
  type: string;
  properties: {
    borocode: string;
    boroname: string;
    shape_area: string;
    shape_leng: string;
  };
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][];
  };
}

export interface BoroughCollection {
  type: string;
  features: Borough[];
}