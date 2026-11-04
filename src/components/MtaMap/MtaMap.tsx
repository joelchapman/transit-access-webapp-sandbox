import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import mapboxgl, { LngLat } from "mapbox-gl";
import dotenv from "dotenv";
import {
  getOutElevatorData,
  updateUpcomingOutagesLayer,
  updateOutageLayer,
  updateStationOutageLayer,
  updateStationComplexLayer,
} from "./layers/CurrentOutages/handlerFunctions";
import {
  outageSourceOptions,
  complexBoundarySourceOptions,
  setMapCenter,
  setManhattanTilt,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  BIRDSEYE_CENTER,
  BIRDSEYE_CENTER_DESKTOP,
  BIRDSEYE_CENTER_TRUE_NORTH,
  BIRDSEYE_CENTER_TRUE_NORTH_DESKTOP,
  BIRDSEYE_ZOOM,
} from "./mtaMapOptions";
import {
  currentOutageProps,
  stationOutageProps,
  stationDotProps,
  animationProps,
  dotView,
} from "./layers/CurrentOutages/currentOutagesProps";
import { stationComplexProps } from "./layers/StationComplexes/stationComplexesProps";
import { complexBoundaryProps } from "./layers/StationComplexes/complexBoundariesProps";
import { upcomingOutageProps } from "./layers/UpcomingOutages/upcomingOutagesProps";
import {
  handleOnClick,
  handleMouseLeave,
  handlePopupEvent,
  handleSearchPopup,
  initializeMtaMap,
  cleanUpPopups,
  removeHoverPopup,
  setSheetHost,
} from "./handlerFunctions";
import {
  getStationOutageArray,
  dealWithMapboxIconOverlap,
  pickTopFeature,
  makeElevatorMap,
  getADAPctByStation,
  getADAPctByComplex,
  getCurrentElevatorCount,
} from "@/utils/dataUtils";
import { MtaStationData, MtaStationFeature } from "@/utils/types";
import { LocationPin } from "../icons";
import { AlertData } from "@/types/alerts";
import HomeSheet, { STATIONS_PANEL_ID } from "../HomeSheet/HomeSheet";
import AlertBanner from "../AlertBanner/AlertBanner";
import { initializeStore } from "@/lib/dataStore";
import { applyZIndexVars } from "@/styles/zIndex";
import { Maximize2, Minimize2 } from "lucide-react";

// Load environment variables
dotenv.config();

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// ─── Map-center alignment constants ──────────────────────────────────────────
// Change these to move the locator dot, map padding, and center calculation
// all at once. CSS vars are written from here.
const MOBILE_POPUPSHIFT_DVH = 30; // map shift on mobile (dvh) -- lower value shifts map up
const DESKTOP_POPUPSHIFT_LEFT = 100; // map shift left on desktop (px)
const DESKTOP_POPUPSHIFT_TOP = -30; // map shift top on desktop (px)
// Matches building-extrusion's minzoom in mapbox-style.json/mapTheme.ts — below this,
// the layer doesn't render, so the toggle shouldn't either
const BUILDING_EXTRUSION_MIN_ZOOM = 15;
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_LINK =
  "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-foreground focus:px-4 focus:text-subhead focus:font-semibold focus:text-background";

const MtaMap = () => {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);

  // STATES: elevator outages, station outages, station view
  // have to use hybrid state and ref (ref to keep stable data, state to re-render)
  const [elevatorDataState, setElevatorDataState] = useState(null);
  const elevatorDataRef = useRef(null);
  const [upcomingElevatorDataState, setUpcomingElevatorDataState] =
    useState(null);
  const upcomingElevatorDataRef = useRef(null);
  const [upcomingRawData, setUpcomingRawData] = useState<any[] | null>(null);
  const [elevatorRawDataState, setElevatorRawData] = useState(null);
  const elevatorRawDataRef = useRef(null);

  const [stationDataState, setStationDataState] = useState(null);
  const stationDataRef = useRef(null);

  const [stationView, setStationView] = useState<string | null>(null); // app state: enter station view
  const [elevatorView, setElevatorView] = useState<string | null>(null); // app state: enter elevator view

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);

  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);

  const [show3DToggle, setShow3DToggle] = React.useState(false);
  const [buildings3DOn, setBuildings3DOn] = useState(true);
  // Mirrors buildings3DOn for the "pitch" listener below, which is bound once at map
  // init and would otherwise see a stale value from its first render's closure.
  const buildings3DOnRef = useRef(buildings3DOn);
  useEffect(() => {
    buildings3DOnRef.current = buildings3DOn;
  }, [buildings3DOn]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [locateSignal, setLocateSignal] = useState(0);
  // Bumped each time the zoom-out ("birdseye") button is tapped, so HomeSheet can
  // collapse to its minimum size — distinct from organically scrolling/pinching out
  const [zoomOutSignal, setZoomOutSignal] = useState(0);
  const [mapCenterLocation, setMapCenterLocation] = useState<
    [number, number] | null
  >(null);
  const [showCenterPin, setShowCenterPin] = useState(false);
  const showCenterPinRef = useRef(false);
  const [pinDrop, setPinDrop] = useState(false);
  const [isZoomedOut, setIsZoomedOut] = useState(false);
  const [isMapManipulated, setIsMapManipulated] = useState(false);
  const isZoomedOutRef = useRef(false);
  // Hides the pin right when "zoom out" is tapped (its old position doesn't apply to the
  // birdseye view); dragging or zooming back in clears this and the pin reappears
  const [pinSuppressed, setPinSuppressed] = useState(false);
  // Where the camera was right before "zoom out" flew to the birdseye view — lets "zoom in"
  // return there exactly when the user never dragged (so no pin appeared) in between
  const preZoomOutPositionRef = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);

  const [stationData, setStationData] = useState<MtaStationData | null>(null);
  const [systemAlerts, setSystemAlerts] = useState<AlertData[]>([]);

  const [sheetPage, setSheetPage] = useState<HTMLElement | null>(null);
  const stationPopupOpen = sheetPage !== null;

  // Set elevator operational stats in a state
  const [elevatorStats, setElevatorStats] = useState({
    numOutElevators: 0,
    totalElevators: getCurrentElevatorCount(),
    pctInService: 100,
  });

  // track elevator data state change
  useEffect(() => {
    elevatorDataRef.current = elevatorDataState;

    const numOutElevators = elevatorDataState?.length ?? 0;
    const totalElevators = getCurrentElevatorCount();
    const pctInService = Math.round(
      (1 - numOutElevators / totalElevators) * 100,
    );

    setElevatorStats({ numOutElevators, totalElevators, pctInService });
  }, [elevatorDataState]);

  // track elevator raw data state change
  useEffect(() => {
    const map = mapRef.current as mapboxgl.Map;
    if (map?.isStyleLoaded() && elevatorRawDataRef.current) {
      updateOutageLayer(elevatorRawDataRef.current, map);
    }
  }, [elevatorRawDataState]);

  // track station data state change
  useEffect(() => {
    stationDataRef.current = stationDataState;
  }, [stationDataState]);

  // track zoom state change
  useEffect(() => {
    const map = mapRef.current as mapboxgl.Map;
    if (map?.isStyleLoaded()) {
      mapRef.current.on("zoom", () => {
        const zoom = mapRef.current.getZoom();
        setZoomLevel(zoom);
      });
    }
  }, [zoomLevel]);

  function getLatestElevatorData() {
    return elevatorDataRef.current;
  }

  let hoveredFeatureId = null;

  // Popup for station info
  const onHoverPopupRef = useRef(
    new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      className: "onhover-popup", // hover-popup css class
    }),
  );

  const onClickPopupRef = useRef(
    new mapboxgl.Popup({
      anchor: "bottom",
      className: "onclick-popup",
      closeButton: true,
      closeOnClick: true,
    }),
  );

  // Station and elevator details open as a page inside the home sheet
  useEffect(() => {
    setSheetHost({ show: setSheetPage, hide: () => setSheetPage(null) });
    return () => setSheetHost(null);
  }, []);

  const lastMapPositionRef = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
  } | null>(null);

  const captureMapPosition = () => {
    const map = mapRef.current as mapboxgl.Map;
    if (!map) return;
    const { lng, lat } = map.getCenter();
    lastMapPositionRef.current = {
      center: [lng, lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
    };
    if (isZoomedOutRef.current) {
      setIsZoomedOut(false);
      isZoomedOutRef.current = false;
    }
  };

  const handleBack = () => {
    cleanUpPopups();
    const pos = lastMapPositionRef.current;
    if (pos) {
      mapRef.current?.flyTo({
        center: pos.center,
        zoom: pos.zoom,
        bearing: pos.bearing,
        pitch: 0,
        duration: 800,
        essential: true,
      });
    }
  };

  const handleStationSearchSelect = (
    feature,
    elevatorData,
    upcomingElevatorData,
    stationData,
    stationView,
    setStationView,
    elevatorView,
    setElevatorView,
    show3DToggle,
    setShow3DToggle,
    lastUpdated,
    onBack?: () => void,
    walkingToleranceMiles?: number | null,
  ) => {
    handleSearchPopup(
      feature,
      onClickPopupRef,
      mapRef.current,
      elevatorData,
      upcomingElevatorDataRef.current,
      stationDataRef.current,
      stationView,
      setStationView,
      elevatorView,
      setElevatorView,
      show3DToggle,
      setShow3DToggle,
      lastUpdated,
      onBack,
      userLocation,
      walkingToleranceMiles,
    );
  };

  // Run before first paint so z-index vars and shift constants are set
  // before the browser lays out fixed-position elements.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--mobile-shift-dvh", `${MOBILE_POPUPSHIFT_DVH}dvh`);
    root.style.setProperty(
      "--desktop-shift-left",
      `${DESKTOP_POPUPSHIFT_LEFT}px`,
    );
    root.style.setProperty(
      "--desktop-shift-top",
      `${DESKTOP_POPUPSHIFT_TOP}px`,
    );
    applyZIndexVars();
  }, []);

  useEffect(() => {
    async function loadDatasets() {
      const [elevatorsRes, stationsRes, alertsRes] = await Promise.all([
        fetch("/api/elevators"),
        fetch("/api/stations"),
        fetch("/api/alerts"),
      ]);

      const [elevatorsGeoJSON, { complexes, stations }, alertsData] =
        await Promise.all([
          elevatorsRes.json(),
          stationsRes.json(),
          alertsRes.json(),
        ]);

      initializeStore(
        elevatorsGeoJSON,
        complexes,
        stations,
        alertsData.station,
      );
      setStationData(stations as MtaStationData);
      setSystemAlerts(alertsData.system as AlertData[]);
    }

    // Accepts an already running fetch promise so the outage request can
    // run in parallel with loadDatasets() — process the response after
    // initializeStore() has been called.
    async function getOutages(responseProm?: Promise<Response>) {
      const response = await (responseProm ?? fetch("/api/outages"));
      if (!response.ok)
        throw new Error(`Outage fetch failed: ${response.status}`);
      const data = await response.json();
      const currentData = data.filter((el) => el.isupcomingoutage === "N");
      const upcomingData = data.filter((el) => el.isupcomingoutage === "Y");
      setElevatorRawData(currentData);
      elevatorRawDataRef.current = currentData;

      const elevData = getOutElevatorData(currentData);
      const upcomingElevData = getOutElevatorData(upcomingData);

      setElevatorDataState(elevData); // triggers rerender
      setUpcomingElevatorDataState(upcomingElevData);
      setUpcomingRawData(upcomingData);
      elevatorDataRef.current = elevData;
      upcomingElevatorDataRef.current = upcomingData;

      const stationData = getStationOutageArray(currentData);
      setStationDataState(stationData);
      stationDataRef.current = stationData;

      makeElevatorMap(); // an easy way to reference elevators and their stations/complexes

      setLastUpdated(new Date());
      lastUpdatedRef.current = new Date();

      // Trigger layer redraws after data updates
      if (
        mapRef.current?.getSource("outage-data") &&
        elevatorRawDataRef.current
      ) {
        updateOutageLayer(elevatorRawDataRef.current, mapRef.current);
      } else if (!elevatorDataState) {
        console.warn(
          "ElevatorDataState not loaded",
          "Raw Data:",
          elevatorRawDataState,
        );
      }
      if (
        mapRef.current?.getSource("station-outage-data") &&
        stationDataRef.current
      ) {
        updateStationOutageLayer(stationDataRef.current, mapRef.current);
      }
      if (
        mapRef.current?.getSource("station-complexes") &&
        stationDataRef.current
      ) {
        updateStationComplexLayer(stationDataRef.current, mapRef.current);
      }
      if (mapRef.current?.getSource("upcoming-outage-data")) {
        updateUpcomingOutagesLayer(
          upcomingElevatorDataRef.current,
          mapRef.current,
        );
      }
    }
    // Start geolocation immediately — runs in parallel with map loading so the
    // location is resolved by the time the map loads.
    const locationPromise = setMapCenter();

    //   • outagesFetch — network request starts immediately
    //   • loadDatasets — populates the store (must complete first)
    // Then process the outage response once the store is ready.
    async function initialize() {
      const outagesFetch = fetch("/api/outages");
      await loadDatasets();
      getOutages(outagesFetch);
    }
    initialize();

    // Compute the panel-shift padding once so both setPadding and geolocate's
    // fitBoundsOptions always reference the same values.
    const isMobile = window.innerWidth < 768;
    const panelShiftPadding = isMobile
      ? {
          top: Math.max(
            0,
            Math.round(window.innerHeight * (-MOBILE_POPUPSHIFT_DVH / 100)),
          ),
          bottom: Math.max(
            0,
            Math.round(window.innerHeight * (MOBILE_POPUPSHIFT_DVH / 100)),
          ),
          left: 0,
          right: 0,
        }
      : {
          top: Math.max(0, 2 * DESKTOP_POPUPSHIFT_TOP),
          bottom: Math.max(0, -2 * DESKTOP_POPUPSHIFT_TOP),
          left: Math.max(0, 2 * DESKTOP_POPUPSHIFT_LEFT),
          right: Math.max(0, -2 * DESKTOP_POPUPSHIFT_LEFT),
        };

    //Initialize Map
    initializeMtaMap(
      mapRef,
      mapContainer,
      locationPromise,
      setUserLocation,
      () => setLocateSignal((n) => n + 1),
      panelShiftPadding,
      (center) => {
        if (showCenterPinRef.current) setMapCenterLocation(center);
      },
    );

    // Read the bearing the map was constructed with (Manhattan tilt is non-zero by design)
    const initialBearing = mapRef.current?.getBearing() ?? 0;
    document.documentElement.dataset.bearingZero =
      Math.abs(initialBearing) < 0.5 ? "true" : "false";
    document.documentElement.dataset.bearingManhattan =
      Math.abs(initialBearing - setManhattanTilt()) < 0.5 ? "true" : "false";
    mapRef.current?.on("rotate", () => {
      const b = mapRef.current.getBearing();
      document.documentElement.dataset.bearingZero =
        Math.abs(b) < 0.5 ? "true" : "false";
      document.documentElement.dataset.bearingManhattan =
        Math.abs(b - setManhattanTilt()) < 0.5 ? "true" : "false";
    });

    // Shift the map's visual center into the visible area above (mobile) or beside (desktop) the panel.
    // This makes geolocate, flyTo, and the fake-location dot all land at the same screen position.
    mapRef.current?.setPadding(panelShiftPadding);

    mapRef.current?.on("load", () => {
      mapRef.current.setLayoutProperty(
        "transit-elevators",
        "visibility",
        "visible",
      );

      // Set correct initial compass visibility based on the map's starting bearing
      const loadBearing = mapRef.current.getBearing();
      document.documentElement.dataset.bearingZero =
        Math.abs(loadBearing) < 0.5 ? "true" : "false";
      document.documentElement.dataset.bearingManhattan =
        Math.abs(loadBearing - setManhattanTilt()) < 0.5 ? "true" : "false";

      mapRef.current.addSource("station-complexes", outageSourceOptions);
      mapRef.current.addSource("outage-data", outageSourceOptions);
      mapRef.current.addSource("station-outage-data", outageSourceOptions);
      mapRef.current.addSource("upcoming-outage-data", outageSourceOptions);

      if (
        mapRef.current?.getSource("outage-data") &&
        elevatorRawDataRef.current
      ) {
        updateOutageLayer(elevatorRawDataRef.current, mapRef.current);
      }
      if (
        mapRef.current?.getSource("station-outage-data") &&
        stationDataRef.current
      ) {
        updateStationOutageLayer(stationDataRef.current, mapRef.current);
      }
      if (
        mapRef.current?.getSource("station-complexes") &&
        stationDataRef.current
      ) {
        updateStationComplexLayer(stationDataRef.current, mapRef.current);
      }

      if (mapRef.current?.getSource("upcoming-outage-data")) {
        updateUpcomingOutagesLayer(
          upcomingElevatorDataRef.current,
          mapRef.current,
        );
      }

      // Add outage layer with icons based on isBroken property

      mapRef.current.addLayer(currentOutageProps);

      mapRef.current.addLayer(stationDotProps);

      mapRef.current.addLayer(stationOutageProps); // icons (comes in at zooms higher than dotLevel)
      mapRef.current.addLayer(stationComplexProps);
      mapRef.current.addLayer(upcomingOutageProps);

      // Moves transit elevators layer so it's not hidden by outage layer
      mapRef.current.moveLayer("stationOutages", "transit-elevators");
      mapRef.current.moveLayer(
        "mta-subway-complexes-accessible2",
        "transit-elevators",
      );
      // The planned-outage wrench is a badge on the elevator marker, so it draws on top of it
      mapRef.current.moveLayer("upcoming-outages");

      // Draw a translucent complex boundary
      mapRef.current.addSource(
        "active-complex-boundary",
        complexBoundarySourceOptions,
      );
      mapRef.current.addLayer(complexBoundaryProps);

      mapRef.current.on("zoom", () => {
        const zoom = mapRef.current.getZoom();
        setZoomLevel(zoom);
      });

      mapRef.current.on("click", () =>
        removeHoverPopup(onHoverPopupRef.current),
      );
      let userZoom = false;
      mapRef.current.on("zoomstart", (e) => {
        removeHoverPopup(onHoverPopupRef.current);
        if (!isZoomedOutRef.current) {
          if (e.originalEvent) {
            userZoom = true;
            showCenterPinRef.current = true;
            setShowCenterPin(true);
            setPinDrop(true);
          }
        }
      });
      mapRef.current.on("zoomend", () => {
        if (userZoom) {
          setPinDrop(false);
          userZoom = false;
        }
      });

      mapRef.current.on("pitch", () => {
        const pitch = mapRef.current.getPitch();
        // Keep the toggle visible if buildings are on, even once pitch settles back to 0
        setShow3DToggle(pitch !== 0 || buildings3DOnRef.current);
        document.documentElement.style.setProperty(
          "--map-pitch-deg",
          `${pitch}deg`,
        );
      });

      // Direct manipulation only: camera moves from code (flyTo and friends) carry no originalEvent.
      // Neither does Mapbox's wheel zoom, so that one is checked for separately.
      const activeGestures = new Set<string>();
      ["drag", "zoom", "rotate", "pitch"].forEach((gesture) => {
        mapRef.current.on(`${gesture}start`, (e) => {
          if (!e.originalEvent && !mapRef.current.scrollZoom.isActive()) return;
          activeGestures.add(gesture);
          setIsMapManipulated(true);
        });
        mapRef.current.on(`${gesture}end`, () => {
          activeGestures.delete(gesture);
          setIsMapManipulated(activeGestures.size > 0);
        });
      });

      mapRef.current.on("dragstart", () => {
        showCenterPinRef.current = true;
        setShowCenterPin(true);
        setPinDrop(true);
        setPinSuppressed(false);
      });

      mapRef.current.on("dragend", () => {
        const isMobile = window.innerWidth < 768;
        const pinPixel: [number, number] = isMobile
          ? [
              window.innerWidth / 2,
              (window.innerHeight * (1 - MOBILE_POPUPSHIFT_DVH / 100)) / 2,
            ]
          : [
              window.innerWidth / 2 + DESKTOP_POPUPSHIFT_LEFT,
              window.innerHeight / 2 + DESKTOP_POPUPSHIFT_TOP,
            ];

        // Wait for inertia to finish before bearing shift and dot drop.
        mapRef.current.once("moveend", () => {
          setPinDrop(false);
          // Auto-tilt disabled — bearing is now user-controlled via compass toggle
          // (future: re-enable as optional user setting via getBearingByLocation)
          const { lng: dLng, lat: dLat } = mapRef.current.unproject(pinPixel);
          setMapCenterLocation([dLng, dLat]);
        });
      });

      const priority = [
        "upcoming-outages",
        "stationDots", // low-zoom level dot layer
        "stationOutages",
        "mta-subway-stations-accessible",
        "mta-subway-complexes-accessible2",
        "transit-elevators",
        "outages",
        "mta-subway-stations-inaccessible",
      ];

      getADAPctByComplex();

      // One click listener for all interactive layers
      mapRef.current?.on("click", (e) => {
        const zoom = mapRef.current?.getZoom() ?? 0;
        let features;

        if (zoom < dotView) {
          // Give dots a slightly expanded tap area
          const buf = 6;
          const dotTap = mapRef.current?.queryRenderedFeatures(
            [
              [e.point.x - buf, e.point.y - buf],
              [e.point.x + buf, e.point.y + buf],
            ],
            { layers: ["stationDots"] },
          );
          features = dotTap?.length
            ? dotTap
            : mapRef.current?.queryRenderedFeatures(e.point, {
                layers: priority.filter((l) => l !== "stationDots"),
              });
        } else {
          // Dots are gone at zoom ≥ dotLevel; use the full priority list minus dots.
          features = mapRef.current?.queryRenderedFeatures(e.point, {
            layers: priority.filter((l) => l !== "stationDots"),
          });
        }

        const prioritizedFeature = pickTopFeature(features, priority, e.lngLat);

        if (!features || !features.length) return;

        // Augment the event object to look like a layer-specific event
        const augmentedEvent = {
          ...e,
          features: [prioritizedFeature],
        };

        const layerId = prioritizedFeature.layer.id;

        switch (layerId) {
          case "stationDots":
          case "stationOutages":
          case "mta-subway-stations-accessible":
          case "mta-subway-stations-inaccessible":
          case "mta-subway-stations-inaccessible-icon2":
            captureMapPosition();
            handleOnClick(
              augmentedEvent,
              onClickPopupRef,
              mapRef.current,
              getLatestElevatorData(),
              upcomingElevatorDataRef.current,
              stationDataRef.current,
              stationView,
              setStationView,
              elevatorView,
              setElevatorView,
              show3DToggle,
              setShow3DToggle,
              lastUpdatedRef.current,
              handleBack,
              userLocation,
            );
            break;

          case "mta-subway-complexes-accessible2":
            if (mapRef.current.getZoom() > 15) {
              captureMapPosition();
              let confirmedClick = dealWithMapboxIconOverlap(augmentedEvent);
              handleOnClick(
                confirmedClick,
                onClickPopupRef,
                mapRef.current,
                getLatestElevatorData(),
                upcomingElevatorDataRef.current,
                stationDataRef.current,
                stationView,
                setStationView,
                elevatorView,
                setElevatorView,
                show3DToggle,
                setShow3DToggle,
                lastUpdatedRef.current,
                handleBack,
              );
            }
            break;

          case "transit-elevators":
          case "outages":
            if ((mapRef.current?.getZoom?.() || 0) >= 15) {
              handleOnClick(
                augmentedEvent,
                onClickPopupRef,
                mapRef.current,
                getLatestElevatorData(),
                upcomingElevatorDataRef.current,
                stationDataRef.current,
                stationView,
                setStationView,
                elevatorView,
                setElevatorView,
                show3DToggle,
                setShow3DToggle,
                lastUpdatedRef.current,
                undefined,
                userLocation,
              );
            }
            break;

          case "upcoming-outages":
            if (isTouch) {
              let confirmedClick = dealWithMapboxIconOverlap(augmentedEvent);
              hoveredFeatureId = handlePopupEvent(
                confirmedClick,
                hoveredFeatureId,
                mapRef.current,
                onHoverPopupRef.current,
                true,
              );
            }
            break;

          default:
            break;
        }
      });

      // Track zoom level separately (one global listener)
      mapRef.current?.on("zoom", () => {
        const zoom = mapRef.current?.getZoom();
        setZoomLevel(zoom ?? 0);
        mapRef.current.setPaintProperty(
          "mta-subway-stations-accessible",
          "icon-opacity",
          ["step", ["zoom"], 0, dotView, 1, 15, 0],
        );
      });

      // Clear birdseye mode once any movement settles above dotView
      mapRef.current?.on("moveend", () => {
        if (isZoomedOutRef.current && mapRef.current?.getZoom() >= dotView) {
          isZoomedOutRef.current = false;
          setIsZoomedOut(false);
        }
      });
      const isTouch = navigator.maxTouchPoints > 0;

      // Hover logic remains separate for non-touch
      if (!isTouch) {
        mapRef.current.on("mousemove", "upcoming-outages", (e) => {
          hoveredFeatureId = handlePopupEvent(
            e,
            hoveredFeatureId,
            mapRef.current,
            onHoverPopupRef.current,
            false,
          );
        });

        mapRef.current.on("mouseleave", "upcoming-outages", () => {
          hoveredFeatureId = handleMouseLeave(
            hoveredFeatureId,
            mapRef.current,
            onHoverPopupRef.current,
          );
        });
      }
    });

    // Set up an interval to fetch outages every 30 seconds.
    const intervalId = setInterval(getOutages, 30000);

    return () => {
      clearInterval(intervalId);
      mapRef.current.remove();
    };
  }, []);

  // Clear map-center mode when the user taps the geolocate button
  useEffect(() => {
    if (locateSignal > 0) {
      setMapCenterLocation(null);
      showCenterPinRef.current = false;
      setShowCenterPin(false);
    }
  }, [locateSignal]);

  const hideComplexBoundary = (map: mapboxgl.Map) => {
    if (map.getLayer("active-complex-boundary-layer")) {
      map.setLayoutProperty("active-complex-boundary-layer", "visibility", "none");
    }
  };

  // Sheet back button: close the station page and fly back to where the user was
  const closeStation = () => {
    handleBack();
    setStationView(null);
    setElevatorView(null);
    const map = mapRef.current as mapboxgl.Map;
    if (map) hideComplexBoundary(map);
  };

  const selectStation = (feature: MtaStationFeature, walkingToleranceMiles?: number | null) => {
    const map = mapRef.current as mapboxgl.Map;
    if (!map) return;

    captureMapPosition();
    handleStationSearchSelect(
      { ...feature, layer: { id: "mta-subway-stations-all" } },
      getLatestElevatorData(),
      upcomingElevatorDataRef.current,
      stationDataRef.current,
      stationView,
      setStationView,
      elevatorView,
      setElevatorView,
      show3DToggle,
      setShow3DToggle,
      lastUpdatedRef.current,
      handleBack,
      walkingToleranceMiles,
    );

    // Accessible stations are framed by the station view; inaccessible ones need a fly-to
    if (feature.properties.ada === "0") {
      map.flyTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: 15,
        pitch: 0,
        bearing: feature.properties.borough === "M" ? setManhattanTilt() : 0,
        speed: 1.8,
      });
    }
  };

  return (
    <>
      {/* Tab order follows this DOM order: skip links, alerts, stations, then the map and its controls.
          On mobile the sheet is portaled to the end of the page, which is why "Skip to stations" matters. */}
      <a href={`#${STATIONS_PANEL_ID}`} className={SKIP_LINK}>
        Skip to stations
      </a>
      <a
        href="#map-container"
        className={SKIP_LINK}
        onClick={(e) => {
          e.preventDefault();
          mapRef.current?.getCanvas().focus();
        }}
      >
        Skip to map
      </a>

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[996] mx-auto flex max-w-lg md:left-[412px] flex-col gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <AlertBanner alerts={systemAlerts ?? []} />
      </div>

      <HomeSheet
        open
        page={sheetPage}
        onBack={closeStation}
        userLocation={userLocation}
        overrideLocation={mapCenterLocation}
        locateSignal={locateSignal}
        zoomOutSignal={zoomOutSignal}
        isMapManipulated={isMapManipulated}
        elevatorData={elevatorDataState}
        upcomingElevatorData={upcomingRawData}
        numOutElevators={elevatorStats.numOutElevators}
        totalElevators={elevatorStats.totalElevators}
        lastUpdated={lastUpdated}
        stationData={stationData}
        stationOutages={stationDataState}
        onSelectStation={selectStation}
      />

      <div ref={mapContainer} id="map-container" className="map-container" />

      {showCenterPin && !stationPopupOpen && !pinSuppressed && (
        <div
          className={`map-center-pin${pinDrop ? " floating" : ""}`}
          aria-hidden="true"
        >
          <LocationPin size="1.5rem"/>
        </div>
      )}

      <div className="map-zoom-out">
        <button
          className={`map-zoom-out-btn${isZoomedOut ? " map-zoom-out-btn--active" : ""}`}
          aria-label={
            isZoomedOut
              ? "Zoom in"
              : "Zoom out to see entire system"
          }
          title={isZoomedOut ? "Zoom in" : "Zoom out"}
          onClick={() => {
            const map = mapRef.current as mapboxgl.Map;
            if (!map) return;

            if (isZoomedOutRef.current) {
              // Zooming back in — any pin that existed before "zoom out" reappears
              setPinSuppressed(false);
              if (showCenterPinRef.current && mapCenterLocation) {
                // User dragged while zoomed out, revealing the pin — return to it
                map.flyTo({
                  center: mapCenterLocation,
                  zoom: DEFAULT_ZOOM,
                  bearing: map.getBearing(),
                  pitch: 0,
                  duration: 800,
                  essential: true,
                });
              } else if (preZoomOutPositionRef.current) {
                // No drag happened — go back exactly where we were, not to the hidden pin
                const pos = preZoomOutPositionRef.current;
                map.flyTo({
                  center: pos.center,
                  zoom: pos.zoom,
                  bearing: pos.bearing,
                  pitch: pos.pitch,
                  duration: 800,
                  essential: true,
                });
              } else if (userLocation) {
                map.flyTo({
                  center: userLocation,
                  zoom: DEFAULT_ZOOM,
                  bearing: map.getBearing(),
                  pitch: 0,
                  duration: 800,
                  essential: true,
                });
              }
              setIsZoomedOut(false);
              isZoomedOutRef.current = false;
              return;
            }

            const { lng: preLng, lat: preLat } = map.getCenter();
            preZoomOutPositionRef.current = {
              center: [preLng, preLat],
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            };
            // Hide any existing pin for the birdseye view — dragging or zooming back
            // in (to the same pin location) will bring it back
            setPinSuppressed(true);
            // Tell HomeSheet to collapse to its minimum size for the birdseye view
            setZoomOutSignal((n) => n + 1);

            cleanUpPopups();
            setStationView(null);
            setElevatorView(null);
            setIsZoomedOut(true);
            isZoomedOutRef.current = true;

            const isDesktop = window.innerWidth >= 768;
            // BIRDSEYE_CENTER/DESKTOP were tuned at the Manhattan tilt and crop the system
            // wrong (too far left) at any other bearing — same convention as data-bearing-manhattan
            const isManhattanTilt = Math.abs(map.getBearing() - setManhattanTilt()) < 0.5;
            const birdseyeCenter = isDesktop
              ? (isManhattanTilt ? BIRDSEYE_CENTER_DESKTOP : BIRDSEYE_CENTER_TRUE_NORTH_DESKTOP)
              : (isManhattanTilt ? BIRDSEYE_CENTER : BIRDSEYE_CENTER_TRUE_NORTH);
            map.flyTo({
              center: birdseyeCenter,
              zoom: BIRDSEYE_ZOOM,
              pitch: 0,
              bearing: map.getBearing(),
              speed: 3.2,
              curve: 1.5,
              easing: (t: number) => Math.sin((t * Math.PI) / 2),
              padding: isDesktop
                ? {
                    top: Math.max(0, 2 * DESKTOP_POPUPSHIFT_TOP),
                    bottom: Math.max(0, -2 * DESKTOP_POPUPSHIFT_TOP),
                    left: Math.max(0, 2 * DESKTOP_POPUPSHIFT_LEFT),
                    right: 0,
                  }
                : {
                    top: 0,
                    bottom: Math.round(
                      (window.innerHeight * MOBILE_POPUPSHIFT_DVH) / 100,
                    ),
                    left: 0,
                    right: 0,
                  },
            });

            if (map.getLayer("active-complex-boundary-layer")) {
              map.setLayoutProperty(
                "active-complex-boundary-layer",
                "visibility",
                "none",
              );
            }
            // No pin reveal here — the pin only appears once the user actually drags
            // (see the "dragstart"/"dragend" handlers above)
          }}
        >
          {isZoomedOut ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </button>
      </div>

      <>
        {/* show3DToggle tracks pitch !== 0 || buildings3DOn (see the "pitch" listener above
            and this button's onClick) — stays visible while buildings are on even at pitch 0.
            Also gated on zoom: building-extrusion itself doesn't render below that zoom. */}
        {show3DToggle && zoomLevel >= BUILDING_EXTRUSION_MIN_ZOOM && (
          <button
            type="button"
            className={`show-3d-button-wrapper map-zoom-out-btn text-footnote font-bold${buildings3DOn ? " map-zoom-out-btn--active" : ""}`}
            aria-pressed={buildings3DOn}
            aria-label={buildings3DOn ? "Hide 3D buildings" : "Show 3D buildings"}
            title={buildings3DOn ? "Hide 3D buildings" : "Show 3D buildings"}
            onClick={() => {
              if (!mapRef.current) return;
              const next = !buildings3DOn;
              setBuildings3DOn(next);
              setShow3DToggle(mapRef.current.getPitch() !== 0 || next);
              if (mapRef.current.getLayer("building-extrusion")) {
                mapRef.current.setLayoutProperty(
                  "building-extrusion",
                  "visibility",
                  next ? "visible" : "none",
                );
              }
            }}
          >
            3D
          </button>
        )}
      </>
    </>
  );
};

export default MtaMap;
