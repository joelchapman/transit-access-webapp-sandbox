import React, { useEffect, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Command as CommandPrimitive } from "cmdk";
import { matchSorter } from "match-sorter";
import { Info, Search, X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { StatusPill, StatusTone, OutOfServiceIcon, MaintenanceBadge } from "@/components/StationPopup/StatusBadges";
import { ROW_PRESS, BUTTON_PRESS } from "@/lib/interaction";
import { Drawer, DrawerPortal, DrawerTitle } from "@/components/ui/drawer";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { LineBullets } from "@/components/LineBullets/LineBullets";
import { StatusIcon } from "@/components/StatusIcon/StatusIcon";
import LegendPage from "@/components/Legend/LegendPage";
import { LocationPin, AccessibleIconWhite, ElevatorIcon, ElevatorInvertedIcon, Ramp } from "@/components/icons";
import { useNearbyStations, WALKING_RADII, formatWalkingDistance } from "./useNearbyStations";
import { getComplexesDataset } from "@/lib/dataStore";
import { getElevatorsByComplexId } from "@/utils/dataUtils";
import { MtaStationData, MtaStationFeature } from "@/utils/types";
import { cn } from "@/lib/utils";

const SNAP_PEEK = "136px";
const SNAP_HALF = 0.55;
const SNAP_FULL = 0.94;
const MAX_RESULTS = 40;
// Matches the breakpoint MtaMap.tsx already uses for desktop-only map behavior
const DESKTOP_QUERY = "(min-width: 768px)";

// Bottom sheet on mobile, left side panel on desktop — this component stays mounted
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
  routes: Set<string>;
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
  elevatorData: any[] | null;
  upcomingElevatorData: any[] | null;
  // Station or elevator details, built by the map handlers, shown as a sub-page
  page: HTMLElement | null;
  onBack: () => void;
  onSelectStation: (feature: MtaStationFeature, walkingToleranceMiles?: number | null) => void;
}

const COMMUNITY_LINKS = [
  { label: "Send feedback", href: "https://app.youform.com/forms/dnefmhvd" },
  { label: "Email the team", href: "mailto:team@transitaccess.org" },
  { label: "Join our Discord", href: "https://discord.gg/HgZVSJ9SE8" },
  { label: "Buy us a coffee", href: "https://www.buymeacoffee.com/transitaccess" },
  { label: "Instagram", href: "https://www.instagram.com/transitaccess/" },
  { label: "TikTok", href: "https://www.tiktok.com/@transitaccess" },
  { label: "Bluesky", href: "https://bsky.app/profile/transitaccess.bsky.social" },
];

function StationLabel({ name, routes }: { name: string; routes: string[] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
      <span className="max-w-full truncate text-headline font-semibold">{name}</span>
      <LineBullets routes={routes} size="sm" />
    </span>
  );
}

const toBool = (v: unknown) => v === true || v === "true" || v === "1";

// A status icon that reveals its label on hover (desktop) or tap (touch) — a stateful tap toggle
// layered under the same hover-only CSS language LineBullets uses for its fan-out.
// tone="out" makes the revealed label match OutOfServicePill's look (solid red, white text).
function IconWithLabel({ icon, label, tone = "neutral" }: { icon: React.ReactNode; label: string; tone?: "out" | "neutral" }) {
  const [open, setOpen] = useState(false);
  const pill = tone === "out";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      onBlur={() => setOpen(false)}
      className="group/hint inline-flex shrink-0 items-center"
    >
      <span className="shrink-0">{icon}</span>
      <span
        aria-hidden="true"
        className={cn(
          "overflow-hidden whitespace-nowrap text-caption font-semibold transition-[max-width,margin,padding,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          pill && "rounded-full",
          open
            ? cn("ml-1 max-w-[120px] opacity-100", pill && "bg-status-out px-2 py-0.5 text-white")
            : cn(
                "max-w-0 opacity-0",
                "[@media(hover:hover)]:group-hover/hint:ml-1 [@media(hover:hover)]:group-hover/hint:max-w-[120px] [@media(hover:hover)]:group-hover/hint:opacity-100",
                pill &&
                  "[@media(hover:hover)]:group-hover/hint:bg-status-out [@media(hover:hover)]:group-hover/hint:px-2 [@media(hover:hover)]:group-hover/hint:py-0.5 [@media(hover:hover)]:group-hover/hint:text-white",
              ),
        )}
      >
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

// One out-of-service elevator, indented below its station — same info the old
// NearbyStationsPopup showed per elevator, ported to the new row style.
function OutElevatorRow({ el }: { el: any }) {
  const isRamp = el.properties.elevatorno?.toLowerCase().includes("ra");
  const isStreet = toBool(el.properties.isStreet);
  const lines = (el.properties.linesServed || "").replace(/-/g, "").replaceAll("/", " ");
  const direction = el.properties.directionLabel || "";
  const title = isRamp
    ? "Ramp"
    : isStreet
      ? "Street elevator"
      : `Elevator${el.properties.isBridge ? " to overpass" : ""}${el.properties.isMezzTransferOnly ? " to lower mezzanine" : ""}`;

  return (
    <div className="flex items-start gap-2 py-1.5 pl-8 pr-4 text-footnote text-muted-foreground">
      <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
        <IconWithLabel icon={<OutOfServiceIcon className="size-4" />} label="Out of service" tone="out" />
        {el.properties.isRedundant === "1" && (
          <IconWithLabel
            icon={<Star className="size-4 text-status-ok" strokeWidth={2.5} aria-hidden="true" />}
            label="Redundant elevator"
          />
        )}
        <span aria-hidden="true">
          {isRamp ? <Ramp size={16} /> : isStreet ? <ElevatorIcon size={16} /> : <ElevatorInvertedIcon size={16} />}
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate">
        {title}
        {!isRamp && lines && <> <LineBullets routes={lines.split(" ").filter(Boolean)} size="sm" animated={false} /></>}
        {direction && ` (${direction})`}
      </span>
    </div>
  );
}

function OutElevatorList({ elevators }: { elevators: any[] }) {
  if (elevators.length === 0) return null;
  return (
    <div className="flex flex-col pb-1.5">
      {elevators.map((el, i) => (
        <OutElevatorRow key={el.properties.elevatorno ?? i} el={el} />
      ))}
    </div>
  );
}

const STATUS_CHIPS: Record<ComplexStatus, { tone: StatusTone; label: string }> = {
  ok: { tone: "ok", label: "Working" },
  partial: { tone: "partial", label: "Some out" },
  out: { tone: "out", label: "All out" },
};

function StatusChip({ status, label }: { status: ComplexStatus; label?: string }) {
  const chip = STATUS_CHIPS[status];
  return <StatusPill tone={chip.tone}>{label ?? chip.label}</StatusPill>;
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
      <div className="overflow-hidden rounded-xl border border-border [&>*+*]:border-t [&>*+*]:border-border">
        {children}
      </div>
    </section>
  );
}

// A page pushed on top of the station list, with a back button to return to it.
// isDesktop skips vaul's DrawerTitle (it needs a <Drawer> context that the desktop
// panel, rendered outside one, doesn't have) in favor of a plain heading.
function SubPage({
  label,
  onBack,
  scrollable,
  endPadding,
  isDesktop,
  children,
}: {
  label: string;
  onBack: () => void;
  scrollable: boolean;
  endPadding: React.CSSProperties;
  isDesktop: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isDesktop ? <h2 className="sr-only">{label}</h2> : <DrawerTitle className="sr-only">{label}</DrawerTitle>}
      <div className="flex items-center justify-between px-2 pb-1">
        <Button
          variant="ghost"
          onClick={onBack}
          className={cn("h-11 gap-0.5 rounded-full pl-1.5 pr-3 text-body font-normal text-foreground hover:bg-transparent", BUTTON_PRESS)}
        >
          <ChevronLeft className="size-6" />
          Stations
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Close"
          className={cn("-mr-1 size-11 shrink-0 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground", BUTTON_PRESS)}
        >
          <X className="size-5" />
        </Button>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overscroll-contain",
          scrollable ? "overflow-y-auto" : "overflow-hidden",
        )}
        style={endPadding}
      >
        {children}
      </div>
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

// Highlight only while the sheet has focus, so touch users don't see a phantom selection
const itemClass =
  "group/row flex min-h-14 cursor-pointer items-center gap-3 rounded-none px-4 py-3 text-body transition-colors duration-150 data-[selected=true]:bg-transparent hover:!bg-foreground/[0.04] active:!bg-foreground/[0.08] group-focus-within:data-[selected=true]:bg-foreground/[0.04]";

// Same row, but stacked vertically so an out-of-service elevator sublist can live inside the
// same clickable item as the station summary — the whole block, elevators included, is one button.
// cmdk's own CommandItem wrapper bakes in `items-center px-2 py-1.5`; both are overridden here
// (items-stretch, px-0 py-0) so the two children below take the item's full width instead of
// shrinking to their content and centering — which is what let long rows overflow sideways.
const itemWithSublistClass =
  "group/row flex flex-col items-stretch gap-0 cursor-pointer rounded-none px-0 py-0 text-body transition-colors duration-150 data-[selected=true]:bg-transparent hover:!bg-foreground/[0.04] active:!bg-foreground/[0.08] group-focus-within:data-[selected=true]:bg-foreground/[0.04]";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const isLoaded = lastUpdated !== null;

  // Opening a station lifts the sheet so its details show; going back lowers it
  useEffect(() => {
    if (page) setIsLegendOpen(false);
    setSnap(page ? SNAP_HALF : SNAP_PEEK);
  }, [page]);

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
    if (locateSignal > 0 && !page) setSnap((s) => (s === SNAP_PEEK ? SNAP_HALF : s));
  }, [locateSignal]);

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
      daytime_routes.split(" ").filter(Boolean).forEach((r) => row.routes.add(r));
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
  // Desktop is a static left panel (no drag/snap), so it's always fully scrollable with
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
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-foreground/20" aria-hidden="true" />
      )}

      {page ? (
        <SubPage label="Station details" onBack={onBack} scrollable={isScrollable} endPadding={endPadding} isDesktop={isDesktop}>
          <AdoptedNode node={page} />
        </SubPage>
      ) : isLegendOpen ? (
        <SubPage label="Legend" onBack={closeLegend} scrollable={isScrollable} endPadding={endPadding} isDesktop={isDesktop}>
          <LegendPage
            numOutElevators={numOutElevators}
            totalElevators={totalElevators}
            lastUpdated={lastUpdated}
          />
        </SubPage>
      ) : (
        <Command shouldFilter={false} className="group min-h-0 flex-1 rounded-none bg-transparent">
          <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
            {isDesktop ? (
              <h2 className="text-title">Stations</h2>
            ) : (
              <DrawerTitle className="text-title">Stations</DrawerTitle>
            )}
            <Button
                  variant="ghost"
                  size="icon"
                  className={cn("-mr-2 size-11 shrink-0 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground", BUTTON_PRESS)}
                  aria-label="Legend and about"
                  onClick={openLegend}
                >
                  <Info className="size-5" />
                </Button>
              </header>

              <div className="px-4 pb-3">
                <div className="flex h-11 items-center gap-2 rounded-xl bg-foreground/[0.06] px-4 focus-within:ring-2 focus-within:ring-foreground/10">
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
                    placeholder="Search stations or lines"
                    aria-label="Search stations or lines"
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

              <CommandList
                className={cn(
                  "max-h-none flex-1 overscroll-contain",
                  isScrollable ? "overflow-y-auto" : "overflow-hidden",
                )}
                style={endPadding}
              >
                {isSearching ? (
                  results.length > 0 ? (
                    <CommandGroup className="p-0 px-4">
                      <div className="overflow-hidden rounded-xl border border-border [&>*+*]:border-t [&>*+*]:border-border">
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
                                "relative h-8 shrink-0 rounded-full border px-3 text-footnote font-semibold tabular-nums transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1.5",
                                active
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border text-foreground hover:bg-foreground/[0.04] active:bg-foreground/[0.08]",
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {!nearby.hasLocation ? (
                        <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                          Tap the location button on the map to see accessible stations near you.
                        </p>
                      ) : nearby.stations.length === 0 ? (
                        <p className="px-8 pb-1 text-subhead text-pretty text-muted-foreground">
                          {nearby.radius === null
                            ? "No accessible stations found."
                            : `No accessible stations within ${formatWalkingDistance(nearby.radius)}. Try a longer distance.`}
                        </p>
                      ) : (
                        <CommandGroup className="p-0 px-4">
                          <div className="overflow-hidden rounded-xl border border-border [&>*+*]:border-t [&>*+*]:border-border">
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
                                    <StatusChip
                                      status={station.status}
                                      label={station.status === "partial" && station.outCount > 0 ? `${station.outCount} out` : undefined}
                                    />
                                    {nearby.showDistances && (
                                      <span className="pr-1 text-footnote tabular-nums text-muted-foreground">
                                        {formatWalkingDistance(station.walkingMiles)}
                                        {station.walkMinutes !== null && ` · ${station.walkMinutes} min`}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <OutElevatorList elevators={station.outElevators} />
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
                      <CommandGroup className="p-0">
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
                                <StatusChip status={row.status} />
                              </span>
                              <OutElevatorList elevators={row.outElevators} />
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
                          className={cn("flex min-h-12 items-center justify-between px-4 py-3 text-body", ROW_PRESS)}
                        >
                          {link.label}
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                        </a>
                      ))}
                    </Group>
                  </>
                )}
              </CommandList>
            </Command>
          )}
    </>
  );

  if (isDesktop) {
    if (!open) return null;
    return (
      <div
        role="dialog"
        aria-label="Stations"
        className="fixed left-4 top-[88px] z-[998] flex max-h-[calc(100dvh-104px)] w-[380px] flex-col overflow-hidden rounded-sheet bg-background shadow-[0_1px_2px_oklch(0_0_0/0.08),0_8px_24px_oklch(0_0_0/0.16)] outline-none"
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
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-[998] mx-auto flex h-dvh max-w-lg flex-col rounded-t-sheet bg-background shadow-[0_-1px_0_oklch(0_0_0/0.04),0_-8px_24px_oklch(0_0_0/0.12)] outline-none"
        >
          {content}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
};

export default HomeSheet;
