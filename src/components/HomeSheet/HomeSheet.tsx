import React, { useEffect, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Command as CommandPrimitive } from "cmdk";
import { matchSorter } from "match-sorter";
import { Info, Search, X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { MaintenanceBadge } from "@/components/StationPopup/StatusBadges";
import { ROW_PRESS, BUTTON_PRESS, RAISED_BUTTON } from "@/lib/interaction";
import { Drawer, DrawerPortal, DrawerTitle } from "@/components/ui/drawer";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { LineBullets } from "@/components/LineBullets/LineBullets";
import { StatusIcon } from "@/components/StatusIcon/StatusIcon";
import LegendPage from "@/components/Legend/LegendPage";
import { LocationPin, AccessibleIconWhite } from "@/components/icons";
import { useNearbyStations, WALKING_RADII, formatWalkingDistance } from "./useNearbyStations";
import { getComplexesDataset } from "@/lib/dataStore";
import { getElevatorsByComplexId } from "@/utils/dataUtils";
import { COMMUNITY_LINKS, ROUTE_ORDER } from "@/utils/constants";
import { MtaStationData, MtaStationFeature } from "@/utils/types";
import { cn } from "@/lib/utils";

const SNAP_PEEK = "136px";
const SNAP_HALF = 0.55;
const SNAP_FULL = 0.94;
const MAX_RESULTS = 40;
const GESTURE_RETURN_DELAY_MS = 300;
// A collapsed sheet's content sits below the screen, so keyboard focus must not land in it
const COLLAPSED_PROPS = { inert: "" } as object;
export const STATIONS_PANEL_ID = "stations-panel";
// The sheet's slide takes this long, so even a quick gesture lets it finish getting out of the way
const SHEET_SLIDE_MS = 500;
// Matches the breakpoint MtaMap.tsx already uses for desktop-only map behavior
const DESKTOP_QUERY = "(min-width: 768px)";

// Bottom sheet on mobile, top-left panel on desktop — this component stays mounted
// across a resize, so it needs to react live rather than check window.innerWidth once.
// Starts false (matching the server, which has no window) and corrects itself right
// after mount; reading matchMedia in the initial state would mismatch server vs. client.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

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

interface HomeSheetProps {
  open: boolean;
  numOutElevators: number;
  totalElevators: number;
  lastUpdated: Date | null;
  stationData: MtaStationData | null;
  stationOutages: StationOutage[] | null;
  // Live location (Mapbox geolocate), the dropped map pin, and the tap count on the locate button
  userLocation: LngLat | null;
  overrideLocation: LngLat | null;
  locateSignal: number;
  // Bumped each time the map's "zoom out" (birdseye) button is tapped
  zoomOutSignal: number;
  // True during a direct gesture on the map: pan, zoom, rotate or tilt
  isMapManipulated: boolean;
  elevatorData: any[] | null;
  upcomingElevatorData: any[] | null;
  // Station or elevator details, built by the map handlers, shown as a sub-page
  page: HTMLElement | null;
  onBack: () => void;
  onSelectStation: (feature: MtaStationFeature, walkingToleranceMiles?: number | null) => void;
}

function StationLabel({ name, routes }: { name: string; routes: string[] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
      <span className="max-w-full truncate text-headline font-semibold">{name}</span>
      <LineBullets routes={routes} size="sm" />
    </span>
  );
}

const toBool = (v: unknown) => v === true || v === "true" || v === "1";

// Real subway route codes only — ROUTE_ORDER also has SIR/LIRR/METRONORTH, which are
// multi-character and not how elevator shortdescriptions refer to them anyway
const SUBWAY_ROUTES = new Set(ROUTE_ORDER.filter((r) => r.length === 1));
// A run of route codes joined by "/" ("B/D", "N/Q/R/W", "7"), as a standalone word so it
// doesn't match a letter/digit inside an ordinary word (e.g. the "A" in "Area")
const ROUTE_MENTION = /\b([1-7A-Z](?:\/[1-7A-Z])*)\b/g;

// Splits text into plain-text segments and recognized route mentions (rendered as flat,
// non-overlapping subway bullets in place of the letters), plus the set of routes found
function splitOnRouteMentions(text: string): { nodes: React.ReactNode[]; mentioned: Set<string> } {
  const mentioned = new Set<string>();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(ROUTE_MENTION)) {
    const token = match[1];
    const routes = token.split("/");
    if (!routes.every((r) => SUBWAY_ROUTES.has(r))) continue; // not every slash-part is a real route — leave as plain text
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    routes.forEach((r) => mentioned.add(r));
    nodes.push(<LineBullets key={key++} routes={routes} size="xs" animated={false} overlap={false} />);
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return { nodes, mentioned };
}

const setsEqual = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

// One out-of-service elevator, indented below its station — same info the old
// NearbyStationsPopup showed per elevator, ported to the new row style.
function OutElevatorRow({ el, stationRoutes }: { el: any; stationRoutes: string[] }) {
  const isRamp = el.properties.elevatorno?.toLowerCase().includes("ra");
  const lines: string[] = (el.properties.linesServed || "").replace(/-/g, "").split("/").join(" ").split(" ").filter(Boolean);
  const linesSet = new Set(lines);
  const shortDesc = el.properties.shortdescription || "";
  const { nodes: shortDescNodes, mentioned } = splitOnRouteMentions(shortDesc);
  // Skip the full list if either: the shortdesc's own inline mentions already name every line,
  // or this elevator already covers every line the station has (nothing left to distinguish —
  // e.g. a single-line station where every elevator trivially serves everything). Otherwise
  // (two elevators at the same station can genuinely serve different lines) it's still needed,
  // shown before the shortdesc text.
  const coversStation = stationRoutes.length > 0 && setsEqual(linesSet, new Set(stationRoutes));
  const showBullets = !isRamp && lines.length > 0 && !setsEqual(mentioned, linesSet) && !coversStation;

  return (
    <div className="flex flex-col text-footnote text-muted-foreground">
      {/* Wraps rather than truncating: an ellipsis can only shorten text, so a line that runs out
          inside a group of bullets would just cut a bullet in half */}
      <span className="text-pretty">
        {isRamp && "Ramp"}
        {showBullets && <LineBullets routes={lines} size="xs" animated={false} overlap={false} />}
        {!isRamp && shortDesc && (showBullets ? <> — {shortDescNodes}</> : shortDescNodes)}
      </span>
      {el.properties.isRedundant === "1" && (
        <span className="mt-1 text-caption font-semibold text-status-ok-foreground">Another path available</span>
      )}
    </div>
  );
}

// Stations are assumed to be working, so only an outage says anything: a banner under the station
// with the elevators it affects.
function OutageBanner({
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
        <StatusIcon
          glyph="alert"
          className={cn(
            "size-4",
            isOut ? "text-status-out" : "text-status-partial [--status-icon-glyph:oklch(var(--status-partial-foreground))]",
          )}
        />
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

// A page pushed on top of the station list, with a back button to return to it.
// Marks the top edge of a scroll area once content has slid under the header above it. Scroll
// events don't bubble, so this catches them on the way down; the height check skips sideways
// scrollers inside, like the distance chips.
function ScrollEdge({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onScrollCapture={(e) => {
        const el = e.target as HTMLElement;
        if (el.scrollHeight > el.clientHeight) setIsScrolled(el.scrollTop > 0);
      }}
    >
      {children}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-2 border-t border-border bg-gradient-to-b from-fill-subtle to-transparent transition-opacity duration-150 motion-reduce:transition-none",
          isScrolled ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

// isDesktop skips vaul's DrawerTitle (it needs a <Drawer> context that the desktop
// panel, rendered outside one, doesn't have) in favor of a plain heading.
function SubPage({
  label,
  onBack,
  scrollable,
  endPadding,
  isDesktop,
  hasScrollEdge = false,
  children,
}: {
  label: string;
  onBack: () => void;
  scrollable: boolean;
  endPadding: React.CSSProperties;
  isDesktop: boolean;
  // Station pages leave this off: their pinned title marks the edge itself
  hasScrollEdge?: boolean;
  children: React.ReactNode;
}) {
  const scroller = (
    <div
      {...(scrollable ? {} : COLLAPSED_PROPS)}
      className={cn(
        "min-h-0 flex-1 overscroll-contain",
        scrollable ? "overflow-y-auto" : "overflow-hidden",
      )}
      style={endPadding}
    >
      {children}
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isDesktop ? <h2 className="sr-only">{label}</h2> : <DrawerTitle className="sr-only">{label}</DrawerTitle>}
      {/* The visible buttons sit 4px inside their tap areas, so desktop's pt-3 and the px-3 put them 16px from the panel's edges */}
      <div className={cn("flex items-center justify-between px-3 pb-1", isDesktop && "pt-3")}>
        <Button
          variant="ghost"
          onClick={onBack}
          className={cn("h-11 gap-0.5 rounded-full pl-3 pr-[18px] text-body font-normal text-foreground", RAISED_BUTTON)}
        >
          <ChevronLeft className="size-6" />
          Stations
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Close"
          className={cn("size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground", RAISED_BUTTON)}
        >
          <X className="size-5" />
        </Button>
      </div>
      {hasScrollEdge ? <ScrollEdge>{scroller}</ScrollEdge> : scroller}
    </div>
  );
}

// The map handlers render station details into their own React root; adopt that node
function AdoptedNode({ node }: { node: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.replaceChildren(node);
    ref.current?.parentElement?.scrollTo({ top: 0 });
  }, [node]);

  return <div ref={ref} />;
}

// Highlight only while the search field has focus: that's what the arrow keys move the selection
// from, so touch users don't see a phantom selection and it clears once focus moves elsewhere
const itemClass =
  "focus-ring-inset group/row flex min-h-14 cursor-pointer items-center gap-3 rounded-none px-4 py-3 text-body transition-colors duration-150 data-[selected=true]:bg-transparent hover:!bg-state-hover active:!bg-state-press group-has-[[cmdk-input]:focus]:data-[selected=true]:bg-state-hover";

// Same row, but stacked vertically so an out-of-service elevator sublist can live inside the
// same clickable item as the station summary — the whole block, elevators included, is one button.
// cmdk's own CommandItem wrapper bakes in `items-center px-2 py-1.5`; both are overridden here
// (items-stretch, px-0 py-0) so the two children below take the item's full width instead of
// shrinking to their content and centering — which is what let long rows overflow sideways.
const itemWithSublistClass =
  "focus-ring-inset group/row flex flex-col items-stretch gap-0 cursor-pointer rounded-none px-0 py-0 text-body transition-colors duration-150 data-[selected=true]:bg-transparent hover:!bg-state-hover active:!bg-state-press group-has-[[cmdk-input]:focus]:data-[selected=true]:bg-state-hover";

const HomeSheet: React.FC<HomeSheetProps> = ({
  open,
  numOutElevators,
  totalElevators,
  lastUpdated,
  stationData,
  stationOutages,
  userLocation,
  overrideLocation,
  locateSignal,
  zoomOutSignal,
  isMapManipulated,
  elevatorData,
  upcomingElevatorData,
  page,
  onBack,
  onSelectStation,
}) => {
  const isDesktop = useIsDesktop();
  const [snap, setSnap] = useState<number | string | null>(SNAP_PEEK);
  const [query, setQuery] = useState("");
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  // Out of the way for a map gesture: minimized on mobile, off the left edge on desktop
  const [isTucked, setIsTucked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The mobile height to return to after a map gesture; null when there's nothing to restore
  const snapBeforeGesture = useRef<number | string | null>(null);
  const tuckedAt = useRef(0);

  const isLoaded = lastUpdated !== null;

  // Opening a station lifts the sheet so its details show; going back lowers it
  useEffect(() => {
    if (page) setIsLegendOpen(false);
    snapBeforeGesture.current = null;
    setSnap(page ? SNAP_HALF : SNAP_PEEK);
  }, [page]);

  // Leaving a sub-page removes whatever had focus, so bring it back to the panel. Stations move
  // focus to their own title on the way in.
  const wasOnSubPage = useRef(false);
  useEffect(() => {
    const onSubPage = !!page || isLegendOpen;
    if (onSubPage === wasOnSubPage.current) return;
    wasOnSubPage.current = onSubPage;
    if (!page) document.getElementById(STATIONS_PANEL_ID)?.focus({ preventScroll: true });
  }, [page, isLegendOpen]);

  // Touching the map tucks the sheet away until shortly after the gesture ends. Another gesture
  // before then restarts the wait; moving the sheet in the meantime cancels the return.
  useEffect(() => {
    if (isMapManipulated) {
      // The legend doesn't come back: a gesture dismisses it to the Stations screen
      if (isLegendOpen) {
        setIsLegendOpen(false);
        snapBeforeGesture.current = null;
      } else if (snapBeforeGesture.current === null) {
        snapBeforeGesture.current = snap;
      }
      setSnap(SNAP_PEEK);
      if (!isTucked) tuckedAt.current = Date.now();
      setIsTucked(true);
      return;
    }
    if (!isTucked) return;
    const timer = setTimeout(() => {
      const target = snapBeforeGesture.current;
      snapBeforeGesture.current = null;
      if (target !== null) setSnap((s) => (s === SNAP_PEEK ? target : s));
      setIsTucked(false);
    }, Math.max(GESTURE_RETURN_DELAY_MS, SHEET_SLIDE_MS - (Date.now() - tuckedAt.current)));
    return () => clearTimeout(timer);
  }, [isMapManipulated]);

  // Map controls (geolocate/zoom-out/compass) and the Mapbox logo/attribution row both lift
  // to stay above the sheet as it rises to its half-height snap point. At full height, they
  // stop following and the sheet (which sits above them in z-index) covers them instead of
  // pushing them off the top of the screen.
  useEffect(() => {
    const height =
      snap === SNAP_FULL ? `${SNAP_HALF * 100}dvh` : typeof snap === "number" ? `${snap * 100}dvh` : snap ?? SNAP_PEEK;
    document.documentElement.style.setProperty("--bottom-popup-h", height);
    document.documentElement.style.setProperty("--sheet-h", height);
  }, [snap]);

  const openLegend = () => {
    setIsLegendOpen(true);
    setSnap(SNAP_FULL);
  };

  const closeLegend = () => {
    setIsLegendOpen(false);
    setSnap(SNAP_PEEK);
  };

  const nearby = useNearbyStations({
    userLocation,
    overrideLocation,
    elevatorData,
    stationOutages,
    upcomingElevatorData,
  });

  // Tapping the map's locate button brings the nearby list into view
  useEffect(() => {
    if (locateSignal === 0 || page) return;
    const raise = (s: number | string | null) => (s === SNAP_PEEK ? SNAP_HALF : s);
    if (snapBeforeGesture.current !== null) snapBeforeGesture.current = raise(snapBeforeGesture.current);
    else setSnap(raise);
  }, [locateSignal]);

  // Tapping the map's zoom-out (birdseye) button collapses the sheet to its minimum size
  useEffect(() => {
    if (zoomOutSignal === 0) return;
    snapBeforeGesture.current = null;
    setSnap(SNAP_PEEK);
  }, [zoomOutSignal]);

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
  const complexes = useMemo(() => {
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
      complexes
        .filter((c) => c.status !== "ok")
        .sort(
          (a, b) => Number(b.status === "out") - Number(a.status === "out") || a.name.localeCompare(b.name),
        ),
    [complexes],
  );

  const select = (feature: MtaStationFeature, walkingToleranceMiles?: number | null) => {
    setQuery("");
    inputRef.current?.blur();
    onSelectStation(feature, walkingToleranceMiles);
  };

  const isSearching = query.trim().length > 0;
  // Desktop is a static panel (no drag/snap), so it's always fully scrollable with
  // ordinary bottom padding. Mobile keeps the snap-point peek/half/full behavior.
  const isScrollable = isDesktop || snap !== SNAP_PEEK;
  // The sheet is always full height and slides down to each snap point, so the part below the
  // screen edge is (1 - snap) of the viewport. Pad by that plus 32px so the last row can always
  // scroll clear of the edge, with visible empty space to show it's the end.
  const hiddenDvh = !isDesktop && typeof snap === "number" ? (1 - snap) * 100 : 0;
  const endPadding = isDesktop
    ? { paddingBottom: "16px" }
    : { paddingBottom: `calc(${hiddenDvh.toFixed(1)}dvh + 32px + env(safe-area-inset-bottom))` };

  const content = (
    <>
      {!isDesktop && (
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-handle" aria-hidden="true" />
      )}

      {page ? (
        <SubPage label="Station details" onBack={onBack} scrollable={isScrollable} endPadding={endPadding} isDesktop={isDesktop}>
          <AdoptedNode node={page} />
        </SubPage>
      ) : isLegendOpen ? (
        <SubPage label="Legend" onBack={closeLegend} scrollable={isScrollable} endPadding={endPadding} isDesktop={isDesktop} hasScrollEdge>
          <LegendPage
            numOutElevators={numOutElevators}
            totalElevators={totalElevators}
            lastUpdated={lastUpdated}
          />
        </SubPage>
      ) : (
        <Command shouldFilter={false} className="group min-h-0 flex-1 rounded-none bg-transparent">
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

              <ScrollEdge>
              <CommandList
                {...(isScrollable ? {} : COLLAPSED_PROPS)}
                className={cn(
                  "max-h-none flex-1 overscroll-contain",
                  isScrollable ? "overflow-y-auto" : "overflow-hidden",
                )}
                style={endPadding}
              >
                {isSearching ? (
                  results.length > 0 ? (
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
                                  <AccessibleIconWhite size={14} fill="currentColor" />
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
                  )
                ) : (
                  <>
                    <section className="pt-3">
                      <div className="flex items-center justify-between px-8 pb-2">
                        <h3 className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          {nearby.isUsingPin && <LocationPin size="12px" />}
                          {nearby.isUsingPin ? "Near the map pin" : "Nearby accessible stations"}
                        </h3>
                      </div>
                      {nearby.showDistances && (
                        <div
                          role="radiogroup"
                          aria-label="Walking distance"
                          className="-mt-1.5 flex gap-2 overflow-x-auto px-4 pb-3 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          {WALKING_RADII.map(({ label, value }) => {
                            const active =
                              value === null ? nearby.radius === null : nearby.radius !== null && Math.abs(value - nearby.radius) < 0.001;
                            return (
                              <button
                                key={label}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => nearby.setRadius(value)}
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

                      {!nearby.hasLocation ? (
                        <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                          Tap the location button on the map to see accessible stations near you.
                        </p>
                      ) : !nearby.showDistances ? (
                        <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                          Transit Access covers NYC subway stations. Drag the map to drop a pin near one.
                        </p>
                      ) : nearby.stations.length === 0 ? (
                        <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                          {nearby.radius === null
                            ? "No accessible stations found."
                            : `No accessible stations within ${formatWalkingDistance(nearby.radius)}. Try a longer distance.`}
                        </p>
                      ) : (
                        <CommandGroup className="overflow-visible p-0 px-4">
                          <div className="focus-ring-group overflow-hidden rounded-xl shadow-raised [--focus-ring-radius:theme(borderRadius.xl)] [&>*+*]:border-t [&>*+*]:border-border">
                            {nearby.stations.map((station) => (
                              <CommandItem
                                key={station.complexId}
                                value={`nearby-${station.complexId}`}
                                onSelect={() => select(station.feature, nearby.radius)}
                                className={itemWithSublistClass}
                              >
                                <span className="flex min-h-14 w-full items-start gap-3 px-4 py-3">
                                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                                    <span className="max-w-full truncate text-headline font-semibold">{station.name}</span>
                                    <LineBullets routes={station.routes} size="sm" />
                                    {station.maintenanceLabel && <MaintenanceBadge when={station.maintenanceLabel} />}
                                    {station.adaNotes && (
                                      <span className="flex items-start gap-1 text-caption text-muted-foreground">
                                        <span className="mt-px shrink-0" aria-hidden="true">
                                          <AccessibleIconWhite size={11} fill="currentColor" />
                                        </span>
                                        {station.adaNotes}
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                                    {nearby.showDistances && (
                                      <button
                                        type="button"
                                        disabled={!nearby.canToggleDistance}
                                        onClick={
                                          nearby.canToggleDistance
                                            ? (e) => {
                                                e.stopPropagation();
                                                nearby.toggleDistanceSource();
                                              }
                                            : undefined
                                        }
                                        aria-label={
                                          nearby.canToggleDistance
                                            ? `${nearby.distanceSource === "gps" ? "GPS" : "Map center"} distance: ${formatWalkingDistance(station.walkingMiles)}. Tap to switch.`
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
                                <OutageBanner status={station.status} count={station.outCount} elevators={station.outElevators} stationRoutes={station.routes} />
                              </CommandItem>
                            ))}
                          </div>
                        </CommandGroup>
                      )}
                    </section>

                    {isLoaded && outageRows.length === 0 ? (
                      <Group>
                        <div className="flex items-center gap-3 px-4 py-4">
                          <StatusIcon glyph="check" className="size-5 text-status-ok" />
                          <p className="text-body">Every station has its elevators running.</p>
                        </div>
                      </Group>
                    ) : (
                      <CommandGroup className="overflow-visible p-0">
                        <Group title={isLoaded ? `Stations with outages · ${outageRows.length}` : "Stations with outages"}>
                          {outageRows.map((row) => (
                            <CommandItem
                              key={row.key}
                              value={`outage-${row.key}`}
                              onSelect={() => select(row.feature)}
                              className={itemWithSublistClass}
                            >
                              <span className="flex min-h-14 w-full items-center gap-3 px-4 py-3">
                                <StationLabel name={row.name} routes={Array.from(row.routes)} />
                              </span>
                              <OutageBanner status={row.status} count={row.outElevators.length} elevators={row.outElevators} stationRoutes={Array.from(row.accessibleRoutes)} />
                            </CommandItem>
                          ))}
                        </Group>
                      </CommandGroup>
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
                  </>
                )}
                {lastUpdated && (
                  <p className="px-4 pb-3 pt-1 text-footnote text-muted-foreground">
                    Last updated: {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </CommandList>
              </ScrollEdge>
            </Command>
          )}
    </>
  );

  if (isDesktop) {
    if (!open) return null;
    return (
      <div
        id={STATIONS_PANEL_ID}
        tabIndex={-1}
        role="region"
        aria-label="Stations"
        className={cn(
          // Same slide as the mobile sheet; the extra 48px clears the 16px gutter and the shadow.
          // The height leaves room for the Mapbox logo and info icon below: 16px top + 73px + 8px gap.
          "fixed left-4 top-4 z-[998] flex max-h-[calc(100dvh-97px)] w-[380px] flex-col overflow-hidden rounded-sheet bg-background shadow-floating outline-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          isTucked && "-translate-x-[calc(100%+48px)]",
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Drawer
      open={open}
      modal={false}
      dismissible={false}
      shouldScaleBackground={false}
      snapPoints={[SNAP_PEEK, SNAP_HALF, SNAP_FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPortal>
        <DrawerPrimitive.Content
          id={STATIONS_PANEL_ID}
          tabIndex={-1}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-[998] mx-auto flex h-dvh max-w-lg flex-col rounded-t-sheet bg-background shadow-sheet outline-none"
        >
          {content}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
};

export default HomeSheet;
