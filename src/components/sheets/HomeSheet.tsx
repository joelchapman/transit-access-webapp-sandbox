import React, { useEffect, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Drawer, DrawerPortal } from "@/components/ui/drawer";
import LegendPage from "@/components/pages/LegendPage";
import { SheetChrome } from "./SheetChrome";
import { HomePage, SNAP_PEEK, SNAP_HALF, SNAP_FULL } from "@/components/pages/HomePage";
import { MtaStationData, MtaStationFeature } from "@/utils/types";
import { cn } from "@/lib/utils";

const GESTURE_RETURN_DELAY_MS = 300;
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
  showOnMapSignal: number;
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

// The map handlers render station details into their own React root; adopt that node
function AdoptedNode({ node }: { node: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.replaceChildren(node);
    ref.current?.parentElement?.scrollTo({ top: 0 });
  }, [node]);

  return <div ref={ref} />;
}

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
  showOnMapSignal,
  isMapManipulated,
  elevatorData,
  upcomingElevatorData,
  page,
  onBack,
  onSelectStation,
}) => {
  const isDesktop = useIsDesktop();
  const [snap, setSnap] = useState<number | string | null>(SNAP_PEEK);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  // Out of the way for a map gesture: minimized on mobile, off the left edge on desktop
  const [isTucked, setIsTucked] = useState(false);
  // The mobile height to return to after a map gesture; null when there's nothing to restore
  const snapBeforeGesture = useRef<number | string | null>(null);
  const tuckedAt = useRef(0);

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
  // before then restarts the wait; moving the sheet in the meantime cancels the return. Mobile
  // only — desktop's panel sits beside the map, not over it, so a gesture never needs to clear it.
  useEffect(() => {
    if (isDesktop) return;
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
  }, [isMapManipulated, isDesktop]);

  // Map controls (geolocate/zoom-out/compass) and the Mapbox logo/attribution row both lift to
  // stay above the sheet as it rises to its half-height snap point — continuously, including
  // mid-drag, not just once the sheet settles. At full height (or past half, mid-drag) they stop
  // following and the sheet (which sits above them in z-index) covers them instead of pushing
  // them off the top of the screen.
  //
  // vaul moves the sheet during a drag with direct DOM writes (no React re-render until it
  // settles), so a snap-state effect alone only catches up after the gesture ends. A
  // MutationObserver on the drawer's style looked like the fix, but firing a synchronous style
  // write on every single mutation vaul makes (i.e. every drag frame) was heavy enough to stall
  // vaul's own frame work — polling once per animation frame instead stays in the same timing
  // budget as everything else, and only writes the CSS vars when the rounded value actually
  // changes. On desktop there's no drawer element (a plain fixed panel instead), so this falls
  // back to the old snap-based value there, same as before.
  useEffect(() => {
    const drawer = document.querySelector("[data-vaul-drawer]") as HTMLElement | null;
    const capPx = window.innerHeight * SNAP_HALF;
    let lastHeight = "";
    let rafId: number;

    const tick = () => {
      const heightPx = drawer
        ? Math.max(0, window.innerHeight - drawer.getBoundingClientRect().top)
        : typeof snap === "number"
          ? snap * window.innerHeight
          : parseFloat(snap ?? SNAP_PEEK);
      const height = `${Math.round(Math.min(heightPx, capPx))}px`;
      if (height !== lastHeight) {
        lastHeight = height;
        document.documentElement.style.setProperty("--bottom-popup-h", height);
        document.documentElement.style.setProperty("--sheet-h", height);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [snap]);

  const openLegend = () => {
    setIsLegendOpen(true);
    setSnap(SNAP_FULL);
  };

  const closeLegend = () => {
    setIsLegendOpen(false);
    setSnap(SNAP_PEEK);
  };

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

  // Tapping "See on map" in an elevator's detail page steps the sheet back to half height so the
  // map is visible underneath, without closing the detail page itself
  useEffect(() => {
    if (showOnMapSignal === 0) return;
    snapBeforeGesture.current = null;
    setSnap(SNAP_HALF);
  }, [showOnMapSignal]);

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
      {/* vaul's own Handle, not a plain div: its actual touch target expands to 44px regardless
          of this visible bar's size, and tapping it cycles through snap points for free. */}
      {!isDesktop && (
        <DrawerPrimitive.Handle className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-handle" />
      )}

      {page ? (
        <SheetChrome label="Station details" onBack={onBack} scrollable={isScrollable} endPadding={endPadding} isDesktop={isDesktop}>
          <AdoptedNode node={page} />
        </SheetChrome>
      ) : isLegendOpen ? (
        <SheetChrome label="Legend" onBack={closeLegend} scrollable={isScrollable} endPadding={endPadding} isDesktop={isDesktop} hasScrollEdge>
          <LegendPage
            numOutElevators={numOutElevators}
            totalElevators={totalElevators}
            lastUpdated={lastUpdated}
          />
        </SheetChrome>
      ) : (
        <HomePage
          isDesktop={isDesktop}
          isScrollable={isScrollable}
          endPadding={endPadding}
          snap={snap}
          setSnap={setSnap}
          openLegend={openLegend}
          lastUpdated={lastUpdated}
          stationData={stationData}
          stationOutages={stationOutages}
          userLocation={userLocation}
          overrideLocation={overrideLocation}
          elevatorData={elevatorData}
          upcomingElevatorData={upcomingElevatorData}
          onSelectStation={onSelectStation}
        />
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
    <>
      <Drawer
        open={open}
        modal={false}
        dismissible={false}
        shouldScaleBackground={false}
        snapPoints={[SNAP_PEEK, SNAP_HALF, SNAP_FULL]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        // We never use vaul's fade/scale-background visuals (modal=false, shouldScaleBackground=
        // false), but its default fadeFromIndex (snapPoints.length - 1) still has a side effect:
        // dragging down from the snap point just below it makes vaul's internal drag-percentage
        // calculation freeze at 1 from the first pixel of movement, which stops the sheet from
        // tracking the drag at all until release. Pointing it past the end of the array keeps
        // that calculation out of the way for every real snap point.
        fadeFromIndex={4}
        // Once a touch is read as "scrolling the list," stay committed to that for a beat so a
        // continued fast swipe doesn't flip into resizing the sheet mid-gesture (vaul's default,
        // 100ms, is too quick to reliably survive a fast swipe).
        scrollLockTimeout={500}
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
    </>
  );
};

export default HomeSheet;
