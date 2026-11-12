import React, { useEffect, useMemo, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { matchSorter } from "match-sorter";
import { Info, Search, X, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { MaintenanceBadge } from "@/components/badges/InfoBadges";
import { ROW_PRESS, BUTTON_PRESS, RAISED_BUTTON } from "@/lib/interaction";
import { DrawerTitle } from "@/components/ui/drawer";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { generateSubwayLines } from "@/utils/generateSubwayLines";
import { LocationPin, AccessibleWhite } from "@/components/icons";
import { AlertStatus } from "@/components/icons/variants/AlertStatus";
import { ScrollEdge, COLLAPSED_PROPS } from "@/components/sheets/SheetChrome";
import { getComplexesDataset } from "@/lib/dataStore";
import {
  getElevatorsByComplexId,
  getNearbyComplexes,
  getComplexOutageLayerFeatures,
  getComplexMaintenanceToday,
  distanceMiles,
  WALKING_DISTANCE_FACTOR,
} from "@/utils/dataUtils";
import { userIsInBounds } from "@/components/maps/mtaMapOptions";
import { COMMUNITY_LINKS } from "@/utils/constants";
import { MtaStationData, MtaStationFeature } from "@/utils/types";
import { cn } from "@/lib/utils";

// The default "Stations" screen: search, the nearby-stations list, the outage list, and the
// community links. Everything specific to that one screen (as opposed to the sheet shell that
// hosts it, or the station-details/Legend pages pushed on top of it) lives here.

export const SNAP_PEEK = "136px";
export const SNAP_HALF = 0.55;
export const SNAP_FULL = 0.94;
const MAX_RESULTS = 40;

type LngLat = [number, number];
type StationOutage = { stationID: string; isOut: boolean };
type ComplexStatus = "ok" | "partial" | "out";

interface ComplexRow {
  key: string;
  name: string;
  // All lines at the complex, regardless of accessibility — what the station actually serves
  routes: Set<string>;
  // Lines reachable via an accessible station here — if an elevator already covers all of
  // these, there's nothing left to distinguish it with, so its bullets can be skipped
  accessibleRoutes: Set<string>;
  feature: MtaStationFeature;
  coords: LngLat;
  isAccessible: boolean;
  status: ComplexStatus;
  outElevators: any[];
}

interface NearbyStation {
  complexId: string;
  name: string;
  routes: string[];
  adaNotes: string | null;
  status: ComplexStatus;
  outCount: number;
  outElevators: any[];
  walkingMiles: number;
  walkMinutes: number | null;
  isPinDistance: boolean;
  maintenanceLabel: string | null;
  feature: any;
}

const setsEqual = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

function StationLabel({ name, routes }: { name: string; routes: string[] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
      <span className="max-w-full truncate text-headline font-semibold">{name}</span>
      {generateSubwayLines({ routes, size: "sm" })}
    </span>
  );
}

// One out-of-service elevator, indented below its station — same info the old
// NearbyStationsPopup showed per elevator, ported to the new row style.
function OutElevatorRow({ el, stationRoutes }: { el: any; stationRoutes: string[] }) {
  const isRamp = el.properties.elevatorno?.toLowerCase().includes("ra");
  const lines: string[] = (el.properties.linesServed || "").replace(/-/g, "").split("/").join(" ").split(" ").filter(Boolean);
  const linesSet = new Set(lines);
  const shortDesc = el.properties.shortdescription || "";
  // shortdesc is free-text prose, not shown through any route-letter parsing — a street name
  // like "E Mosholu Pkwy" or "E 188 St" would otherwise get misread as the E train. Bullets
  // only ever come from the real linesServed field, and only when they'd add something: skip
  // them if this elevator already covers every line the station has (nothing left to
  // distinguish — e.g. a single-line station where every elevator trivially serves everything).
  const coversStation = stationRoutes.length > 0 && setsEqual(linesSet, new Set(stationRoutes));
  const showBullets = !isRamp && lines.length > 0 && !coversStation;

  return (
    <div className="flex flex-col text-footnote text-muted-foreground">
      {/* Wraps rather than truncating: an ellipsis can only shorten text, so a line that runs out
          inside a group of bullets would just cut a bullet in half */}
      <span className="text-pretty">
        {isRamp && "Ramp"}
        {showBullets && generateSubwayLines({ routes: lines, size: "xs", animated: false, overlap: false })}
        {!isRamp && shortDesc && (showBullets ? <> — {shortDesc}</> : shortDesc)}
      </span>
      {el.properties.isRedundant === "1" && (
        <span className="mt-1 text-caption font-semibold text-status-ok-foreground">Alternate path available</span>
      )}
    </div>
  );
}

// Stations are assumed to be working, so only an outage says anything: a banner under the station
// with the elevators it affects.
function OutageSummary({
  status,
  count,
  elevators,
  stationRoutes,
}: {
  status: ComplexStatus;
  count: number;
  elevators: any[];
  stationRoutes: string[];
}) {
  if (status === "ok") return null;
  const isOut = status === "out";
  return (
    <div className={cn("mx-3 mb-3 flex flex-col gap-1.5 rounded-[8px] px-3 py-2", isOut ? "surface-out bg-status-out-muted" : "surface-partial bg-status-partial-muted")}>
      <p
        className={cn(
          "flex items-center justify-between gap-1.5 text-footnote font-semibold",
          isOut ? "text-status-out-foreground" : "text-status-partial-foreground",
        )}
      >
        {isOut ? "All elevators out" : count > 0 ? `${count} ${count === 1 ? "elevator" : "elevators"} out` : "Some elevators out"}
        {isOut ? (
          <AlertStatus glyph="out" className="size-4 text-status-out" />
        ) : (
          <AlertStatus
            glyph="alert"
            className="size-4 text-status-partial [--status-icon-glyph:oklch(var(--status-partial-foreground))]"
          />
        )}
      </p>
      {/* "All elevators out" already says it — listing every one of them adds nothing */}
      {!isOut &&
        elevators.map((el, i) => (
          <OutElevatorRow key={el.properties.elevatorno ?? i} el={el} stationRoutes={stationRoutes} />
        ))}
    </div>
  );
}

// Inset grouped list: outlined card on the white sheet, rows split by dividers
function Group({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pt-6">
      {title && (
        <div className="flex items-center justify-between px-4 pb-2">
          <h3 className="text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h3>
          {action}
        </div>
      )}
      <div className="focus-ring-group overflow-hidden rounded-xl shadow-raised [--focus-ring-radius:theme(borderRadius.xl)] [&>*+*]:border-t [&>*+*]:border-border">
        {children}
      </div>
    </section>
  );
}

// Highlight only while the search field has focus: that's what the arrow keys move the selection
// from, so touch users don't see a phantom selection and it clears once focus moves elsewhere
const itemClass =
  "focus-ring-inset group/row flex min-h-14 cursor-pointer items-center gap-3 rounded-none px-4 py-3 text-body transition-colors duration-150 data-[selected=true]:bg-transparent hover:!bg-state-hover active:!bg-state-press group-has-[[cmdk-input]:focus]:data-[selected=true]:bg-state-hover";

// The default (nearby/outages) list isn't search results — it's just a browsable list, so its
// rows are real, individually Tab-focusable targets instead of cmdk's arrow-key-only virtual
// selection. `relative` is added explicitly because .focus-ring-inset's ring positions itself
// against the nearest positioned ancestor, which CommandItem's own base class provided for free.
// Same row, but stacked vertically so an out-of-service elevator sublist can live inside the
// same clickable item as the station summary — the whole block, elevators included, is one button.
const plainItemWithSublistClass =
  "focus-ring-inset relative group/row flex flex-col items-stretch gap-0 cursor-pointer rounded-none px-0 py-0 text-body transition-colors duration-150 hover:!bg-state-hover active:!bg-state-press";

// Enter/Space activates a row the same way a real <button> would. These rows are plain
// role="button" divs rather than real <button>s because the nearby row nests its own
// distance-toggle button inside, and a <button> can't contain another <button>.
const activateOnKey = (onActivate: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onActivate();
  }
};

const WALKING_RADII: { label: string; value: number | null }[] = [
  { label: "500 ft", value: 500 / 5280 },
  { label: "¼ mi", value: 0.25 },
  { label: "½ mi", value: 0.5 },
  { label: "1 mi", value: 1 },
  { label: "1.5 mi", value: 1.5 },
  { label: "2 mi", value: 2 },
  { label: "3 mi", value: 3 },
  { label: "Any", value: null },
];

function formatWalkingDistance(miles: number) {
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

interface HomePageProps {
  isDesktop: boolean;
  isScrollable: boolean;
  endPadding: React.CSSProperties;
  snap: number | string | null;
  setSnap: React.Dispatch<React.SetStateAction<number | string | null>>;
  openLegend: () => void;
  lastUpdated: Date | null;
  stationData: MtaStationData | null;
  stationOutages: StationOutage[] | null;
  userLocation: LngLat | null;
  overrideLocation: LngLat | null;
  elevatorData: any[] | null;
  upcomingElevatorData: any[] | null;
  onSelectStation: (feature: MtaStationFeature, walkingToleranceMiles?: number | null) => void;
}

export function HomePage({
  isDesktop,
  isScrollable,
  endPadding,
  snap,
  setSnap,
  openLegend,
  lastUpdated,
  stationData,
  stationOutages,
  userLocation,
  overrideLocation,
  elevatorData,
  upcomingElevatorData,
  onSelectStation,
}: HomePageProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Nearby stations (merged from the former standalone useNearbyStations hook — it had
  // only this one caller, so splitting it out didn't earn its keep as a separate file) ---
  const [radius, setRadius] = useState<number | null>(1);
  const [distanceSource, setDistanceSource] = useState<"gps" | "override">("gps");
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
  // Toggle only makes sense when there's a real choice between the two
  const canToggleDistance = !!overrideLocation && !!userLocation;
  const usingPinDistance = canToggleDistance ? distanceSource === "override" : !userLocation;

  const nearbyComplexes = useMemo(() => {
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

  const nearbyStations: NearbyStation[] = useMemo(
    () =>
      nearbyComplexes.map((complex: any) => {
        const complexId = complex.properties.complex_id;
        const outage = outageByComplex.get(complexId);
        const outElevators = getElevatorsByComplexId(complexId).filter((el: any) =>
          elevatorData?.some(
            (out) => out.elevatorNo?.toLowerCase() === el.properties.elevatorno?.toLowerCase(),
          ),
        );
        // GPS by default; falls back to (or is toggled to) the map-pin distance
        const miles = usingPinDistance
          ? complex.distance
          : userLocation
            ? distanceToEntrance(complex, userLocation)
            : complex.distance;
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
          walkMinutes: userInBounds && !usingPinDistance && withinRadius ? Math.max(1, Math.round(walkingMiles * 20)) : null,
          isPinDistance: usingPinDistance,
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
    [nearbyComplexes, outageByComplex, elevatorData, userLocation, userInBounds, usingPinDistance, radius, upcomingElevatorData],
  );

  const hasLocation = origin !== null;
  const showDistances = userInBounds || isUsingPin;
  const toggleDistanceSource = () => setDistanceSource((s) => (s === "gps" ? "override" : "gps"));

  // --- Search + the full station/outage list ---
  const stationOptions = useMemo(
    () =>
      (stationData?.features ?? []).map((feature) => ({
        feature,
        key: feature.properties.gtfs_stop_id,
        name: feature.properties.stop_name,
        routes: feature.properties.daytime_routes.split(" ").filter(Boolean),
        isAccessible: feature.properties.ada !== "0",
      })),
    [stationData],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return matchSorter(stationOptions, query, {
      keys: [(o) => o.name.replace(/-/g, " "), (o) => o.routes.join(" ")],
    }).slice(0, MAX_RESULTS);
  }, [query, stationOptions]);

  // One row per complex. A street elevator outage marks every station in the
  // complex, so a complex is "out" only if each affected station is fully out.
  const complexRows = useMemo(() => {
    if (!stationData) return [];
    const complexInfo = new Map(
      getComplexesDataset().features.map((f) => [f.properties.complex_id, f]),
    );
    const outages = new Map((stationOutages ?? []).map((o) => [o.stationID, o.isOut]));
    const rows = new Map<string, ComplexRow & { affected: boolean[] }>();

    stationData.features.forEach((feature) => {
      const { complex_id, station_id, stop_name, daytime_routes, ada } = feature.properties;
      let row = rows.get(complex_id);
      if (!row) {
        const complex = complexInfo.get(complex_id);
        row = {
          key: complex_id,
          name: complex?.properties.stop_name ?? stop_name,
          routes: new Set(),
          accessibleRoutes: new Set(),
          feature,
          coords: (complex?.geometry.coordinates ?? feature.geometry.coordinates) as LngLat,
          isAccessible: false,
          status: "ok",
          outElevators: getElevatorsByComplexId(complex_id).filter((el: any) =>
            elevatorData?.some(
              (out) => out.elevatorNo?.toLowerCase() === el.properties.elevatorno?.toLowerCase(),
            ),
          ),
          affected: [],
        };
        rows.set(complex_id, row);
      }
      const routesHere = daytime_routes.split(" ").filter(Boolean);
      routesHere.forEach((r) => row.routes.add(r));
      // Match concatenateRoutes (used by the nearby list): only count routes from this
      // complex's accessible stations — an inaccessible station's lines were never reachable
      // by any elevator here, so they shouldn't count toward "this elevator covers everything"
      if (ada !== "0") {
        routesHere.forEach((r) => row.accessibleRoutes.add(r));
      }
      row.isAccessible ||= ada !== "0";
      if (outages.has(station_id)) row.affected.push(outages.get(station_id));
    });

    return Array.from(rows.values()).map(({ affected, ...row }) => ({
      ...row,
      status: (affected.length === 0 ? "ok" : affected.every(Boolean) ? "out" : "partial") as ComplexStatus,
    }));
  }, [stationData, stationOutages, elevatorData]);

  const outageRows = useMemo(
    () =>
      complexRows
        .filter((c) => c.status !== "ok")
        .sort(
          (a, b) => Number(b.status === "out") - Number(a.status === "out") || a.name.localeCompare(b.name),
        ),
    [complexRows],
  );

  const select = (feature: MtaStationFeature, walkingToleranceMiles?: number | null) => {
    setQuery("");
    inputRef.current?.blur();
    onSelectStation(feature, walkingToleranceMiles);
  };

  const isSearching = query.trim().length > 0;
  const isLoaded = lastUpdated !== null;

  return (
    <div className="group flex min-h-0 flex-1 flex-col">
      <Command shouldFilter={false} className="contents">
        <header className={cn("flex items-center justify-between gap-3 px-4 pb-3", isDesktop ? "pt-3" : "pt-1")}>
          {isDesktop ? (
            <h2 className="text-title">Stations</h2>
          ) : (
            <DrawerTitle className="text-title">Stations</DrawerTitle>
          )}
          <div className="-mr-1 flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-11 rounded-full text-muted-foreground hover:text-foreground", RAISED_BUTTON)}
              aria-label="Legend and about"
              onClick={openLegend}
            >
              <Info className="size-5" />
            </Button>
            {/* Desktop's panel has no snap points to move between */}
            {!isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-11 rounded-full text-muted-foreground hover:text-foreground", RAISED_BUTTON)}
                aria-label={snap === SNAP_PEEK ? "Expand" : "Collapse"}
                onClick={() => {
                  if (snap === SNAP_PEEK) return setSnap(SNAP_HALF);
                  setQuery("");
                  inputRef.current?.blur();
                  setSnap(SNAP_PEEK);
                }}
              >
                {snap === SNAP_PEEK ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
              </Button>
            )}
          </div>
        </header>

        <div className="px-4 pb-3">
          <div className="flex h-11 items-center gap-2 rounded-xl bg-fill-subtle px-4 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            <CommandPrimitive.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              onFocus={() => setSnap(SNAP_FULL)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  inputRef.current?.blur();
                  setSnap(SNAP_PEEK);
                }
              }}
              placeholder="Search stations"
              aria-label="Search stations"
              // 16px keeps iOS Safari from zooming on focus
              className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className={cn("-mr-3 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground", BUTTON_PRESS)}
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {isSearching && (
        <ScrollEdge>
        <CommandList
          {...(isScrollable ? {} : COLLAPSED_PROPS)}
          className={cn(
            "max-h-none flex-1 overscroll-contain",
            isScrollable ? "overflow-y-auto" : "overflow-hidden",
          )}
          style={endPadding}
        >
          {results.length > 0 ? (
            <CommandGroup className="overflow-visible p-0 px-4">
              <div className="focus-ring-group overflow-hidden rounded-xl shadow-raised [--focus-ring-radius:theme(borderRadius.xl)] [&>*+*]:border-t [&>*+*]:border-border">
                {results.map((option) => (
                  <CommandItem
                    key={option.key}
                    value={option.key}
                    onSelect={() => select(option.feature)}
                    className={itemClass}
                  >
                    <StationLabel name={option.name} routes={option.routes} />
                    {option.isAccessible ? (
                      <span className="shrink-0 text-muted-foreground">
                        <span aria-hidden="true">
                          <AccessibleWhite size={14} fill="currentColor" />
                        </span>
                        <span className="sr-only">Accessible station</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-footnote text-muted-foreground">Not accessible</span>
                    )}
                  </CommandItem>
                ))}
              </div>
            </CommandGroup>
          ) : (
            <p className="px-8 py-10 text-center text-body text-muted-foreground">
              No stations match “{query}”. Try a street name or a line, like “L”.
            </p>
          )}
          {lastUpdated && (
            <p className="px-4 pb-3 pt-1 text-footnote text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </CommandList>
        </ScrollEdge>
        )}
      </Command>
      {/* Not search results — a plain browsable list, so its rows are real Tab stops
          instead of cmdk's arrow-key-only virtual selection (see itemClass above) */}
      {!isSearching && (
        <ScrollEdge>
        <div
          {...(isScrollable ? {} : COLLAPSED_PROPS)}
          className={cn(
            "max-h-none flex-1 overscroll-contain",
            isScrollable ? "overflow-y-auto" : "overflow-hidden",
          )}
          style={endPadding}
        >
          <section className="pt-3">
            <div className="flex items-center justify-between px-8 pb-2">
              <h3 className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {isUsingPin && <LocationPin size="12px" />}
                {isUsingPin ? "Near the map pin" : "Nearby accessible stations"}
              </h3>
            </div>
            {showDistances && (
              <div
                role="radiogroup"
                aria-label="Walking distance"
                className="-mt-1.5 flex gap-2 overflow-x-auto px-4 pb-3 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {WALKING_RADII.map(({ label, value }) => {
                  const active =
                    value === null ? radius === null : radius !== null && Math.abs(value - radius) < 0.001;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRadius(value)}
                      className={cn(
                        // 32px pill, 44px tap area: the ::before extends the hit box without changing the look
                        "relative h-8 shrink-0 rounded-full px-3 text-footnote font-semibold tabular-nums transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1.5",
                        active
                          ? "bg-foreground text-background shadow-raised"
                          : "text-foreground shadow-raised hover:bg-state-hover active:bg-state-press",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {!hasLocation ? (
              <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                Tap the location button on the map to see accessible stations near you.
              </p>
            ) : !showDistances ? (
              <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                Transit Access covers NYC subway stations. Drag the map to drop a pin near one.
              </p>
            ) : nearbyStations.length === 0 ? (
              <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                {radius === null
                  ? "No accessible stations found."
                  : `No accessible stations within ${formatWalkingDistance(radius)}. Try a longer distance.`}
              </p>
            ) : (
              <div className="px-4">
                <div className="focus-ring-group overflow-hidden rounded-xl shadow-raised [--focus-ring-radius:theme(borderRadius.xl)] [&>*+*]:border-t [&>*+*]:border-border">
                  {nearbyStations.map((station) => {
                    const onActivate = () => select(station.feature, radius);
                    return (
                      <div
                        key={station.complexId}
                        role="button"
                        tabIndex={0}
                        onClick={onActivate}
                        onKeyDown={activateOnKey(onActivate)}
                        className={plainItemWithSublistClass}
                      >
                      <span className="flex min-h-14 w-full items-start gap-3 px-4 py-3">
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                          <span className="max-w-full truncate text-headline font-semibold">{station.name}</span>
                          {generateSubwayLines({ routes: station.routes, size: "sm" })}
                          {station.maintenanceLabel && <MaintenanceBadge when={station.maintenanceLabel} />}
                          {station.adaNotes && (
                            <span className="flex items-start gap-1 text-caption text-muted-foreground">
                              <span className="mt-px shrink-0" aria-hidden="true">
                                <AccessibleWhite size={11} fill="currentColor" />
                              </span>
                              {station.adaNotes}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          {showDistances && (
                            <button
                              type="button"
                              disabled={!canToggleDistance}
                              onClick={
                                canToggleDistance
                                  ? (e) => {
                                      e.stopPropagation();
                                      toggleDistanceSource();
                                    }
                                  : undefined
                              }
                              aria-label={
                                canToggleDistance
                                  ? `${distanceSource === "gps" ? "GPS" : "Map center"} distance: ${formatWalkingDistance(station.walkingMiles)}. Tap to switch.`
                                  : undefined
                              }
                              className="relative flex items-center gap-1 pr-1 text-footnote tabular-nums text-muted-foreground before:absolute before:-inset-3 disabled:cursor-default"
                            >
                              {station.isPinDistance && <LocationPin size="12px" />}
                              {formatWalkingDistance(station.walkingMiles)}
                              {station.walkMinutes !== null && ` · ${station.walkMinutes} min`}
                            </button>
                          )}
                        </span>
                      </span>
                      <OutageSummary status={station.status} count={station.outCount} elevators={station.outElevators} stationRoutes={station.routes} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {isLoaded && outageRows.length === 0 ? (
            <Group>
              <div className="flex items-center gap-3 px-4 py-4">
                <AlertStatus glyph="check" className="size-5 text-status-ok" />
                <p className="text-body">Every station has its elevators running.</p>
              </div>
            </Group>
          ) : (
            <Group title={isLoaded ? `Stations with outages · ${outageRows.length}` : "Stations with outages"}>
              {outageRows.map((row) => {
                const onActivate = () => select(row.feature);
                return (
                  <div
                    key={row.key}
                    role="button"
                    tabIndex={0}
                    onClick={onActivate}
                    onKeyDown={activateOnKey(onActivate)}
                    className={plainItemWithSublistClass}
                  >
                    <span className="flex min-h-14 w-full items-center gap-3 px-4 py-3">
                      <StationLabel name={row.name} routes={Array.from(row.routes)} />
                    </span>
                    <OutageSummary status={row.status} count={row.outElevators.length} elevators={row.outElevators} stationRoutes={Array.from(row.accessibleRoutes)} />
                  </div>
                );
              })}
            </Group>
          )}

          <Group title="Get in touch">
            {COMMUNITY_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noreferrer"
                className={cn("focus-ring-inset relative flex min-h-12 items-center justify-between px-4 py-3 text-body", ROW_PRESS)}
              >
                {link.label}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </a>
            ))}
          </Group>
          {lastUpdated && (
            <p className="px-4 pb-3 pt-1 text-footnote text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
        </ScrollEdge>
      )}
    </div>
  );
}

export default HomePage;
