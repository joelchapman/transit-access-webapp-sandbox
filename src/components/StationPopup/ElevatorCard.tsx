import React, { useEffect, useRef } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";

import { ElevatorStatusMark, InServicePill, OutOfServicePill, AccessTipBadge, OutagePlannedBadge, MaintenanceBadge, RedundantBadge } from "./StatusBadges";
import { ROW_PRESS, EXPAND_EASE } from "@/lib/interaction";
import { AccessTipNote, PlannedOutageNotes, ElevatorFooter } from "./ElevatorNotes";
import { LineBullets } from "@/components/LineBullets/LineBullets";
import {
  highlightElevator,
  walkingDistanceMiles,
  WALKING_TOLERANCE_MILES,
} from "@/utils/dataUtils";
import { ElevatorPopupProps } from "@/utils/types";
import { userIsInBounds } from "@/components/MtaMap/mtaMapOptions";
import { longtermOutageThreshold } from "@/components/MtaMap/layers/UpcomingOutages/upcomingOutagesProps";
import { cn } from "@/lib/utils";

// One elevator: what it connects, whether it works, and the street photo that flies the map to it.
// The section header already says street vs. in-station, so the card leads with where the elevator goes.

const toBool = (v: unknown) => v === true || v === "true" || v === "1";

const ElevatorCard: React.FC<{
  elevator: ElevatorPopupProps;
  map: mapboxgl.Map;
  stationView: string | null;
  setStationView: React.Dispatch<React.SetStateAction<string | null>>;
  activeFlyButton: string | null;
  setActiveFlyButton: React.Dispatch<React.SetStateAction<string | null>>;
  userLocation?: [number, number] | null;
  walkingToleranceMiles?: number | null;
  // Owned by the station view so only one row is open at a time
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}> = ({
  elevator,
  map,
  activeFlyButton,
  setActiveFlyButton,
  userLocation,
  walkingToleranceMiles,
  isOpen,
  onToggle,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const flyButtonRef = useRef<HTMLButtonElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // inert keeps a collapsed row's links and buttons out of the tab order (React 18 has no inert prop)
  useEffect(() => {
    detailsRef.current?.toggleAttribute("inert", !isOpen);
  }, [isOpen]);

  // Once the row has finished growing (and any row above has collapsed), bring it fully into view
  useEffect(() => {
    if (!isOpen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(
      () => rootRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }),
      reduce ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [isOpen]);

  // Clicking anywhere else un-highlights the elevator on the map
  useEffect(() => {
    if (!activeFlyButton) return;
    function handleClickOutside(event: MouseEvent) {
      if (flyButtonRef.current && !flyButtonRef.current.contains(event.target as Node)) {
        setActiveFlyButton(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeFlyButton]);

  useEffect(() => {
    highlightElevator(map, activeFlyButton);
  }, [activeFlyButton]);

  const isRamp = elevator.elevatorno.toLowerCase().includes("ra");
  const isStreet = toBool(elevator.isStreet);
  const isOut = toBool(elevator.isOut);
  const isActive = activeFlyButton === elevator.elevatorno;
  const detailsId = `elevator-details-${elevator.elevatorno}`;

  const lines = elevator.linesServed?.replace(/-/g, "").replaceAll("/", " ") || "";
  const routes = lines.split(" ").filter(Boolean);
  const eta = elevator.estimatedreturntoservice && elevator.estimatedreturntoservice !== "null"
    ? elevator.estimatedreturntoservice.replace(/^(Today|Tomorrow)\b/, (w) => w.toLowerCase())
    : null;

  const upcomingOutages = elevator.isUpcomingOutage
    ? Array.isArray(elevator.isUpcomingOutage)
      ? elevator.isUpcomingOutage
      : [elevator.isUpcomingOutage]
    : [];
  // Worst case wins if there's a mix: any long-term outage makes the badge red
  const hasLongTermOutage = upcomingOutages.some((o) => o.outageDurationDays > longtermOutageThreshold);

  // shortdescription shown as a quiet always-visible note, ahead of the real access_note
  // (which stays behind the AccessTipBadge/AccessTipNote, revealed on open)
  const caveat = elevator.shortdescription;

  const walkingLink = (() => {
    if (!isStreet || !elevator.coordinates || !userLocation) return null;
    if (!userIsInBounds(userLocation[0], userLocation[1])) return null;
    const dist = walkingDistanceMiles(userLocation[0], userLocation[1], elevator.coordinates[0], elevator.coordinates[1]);
    if (dist >= (walkingToleranceMiles ?? WALKING_TOLERANCE_MILES)) return null;
    return `https://www.google.com/maps/dir/?api=1&origin=${userLocation[1]},${userLocation[0]}&destination=${elevator.coordinates[1]},${elevator.coordinates[0]}&travelmode=walking`;
  })();

  // With a photo, status is a mark on the photo: a check when it works, an alert when it doesn't.
  // Without one it's a pill. Screen readers get the words either way.
  const showsOut = isOut && !isRamp;
  const hasPhoto = !!elevator.imageURL;
  const inServiceLabel = isRamp ? "Always in service" : "In service";
  const status = showsOut ? (
    <>
      {hasPhoto ? <span className="sr-only">Out of service</span> : <OutOfServicePill />}
      {toBool(elevator.isRedundant) && <RedundantBadge />}
      {eta && <span className="text-footnote text-status-out-foreground">Back {eta}</span>}
    </>
  ) : hasPhoto ? (
    <span className="sr-only">{inServiceLabel}</span>
  ) : (
    <InServicePill label={inServiceLabel} />
  );

  return (
    <div ref={rootRef} className="flex scroll-mt-2 flex-col">
      <div className="relative">
        {/* The row is the card's only focus stop. Everything inside it, badges included, is plain
            text, so a screen reader announces it all as the button's name */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onToggle(!isOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle(!isOpen);
            }
          }}
          aria-expanded={isOpen}
          aria-controls={detailsId}
          className={cn(
            // Left unpositioned so the focus ring spans the whole row, photo included
            "focus-ring-inset flex w-full min-w-0 cursor-pointer items-stretch py-3 pl-4 text-left",
            ROW_PRESS,
            // Room for the thumbnail while it's showing; snaps (not animated) so text reflows once
            elevator.imageURL && !isOpen ? "min-h-[104px] pr-[116px]" : "pr-4",
          )}
        >
          {/* Fills the row's height: title at the top, status pinned to the bottom, lining up with the photo */}
          <span className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-1.5 text-headline font-semibold text-pretty">
                {isRamp ? "Ramp" : isStreet ? "Street elevator" : (
                  <>
                    Elevator to {elevator.isBridge ? "overpass to " : ""}
                    {elevator.isMezzTransferOnly ? "lower mezzanine to " : ""}
                  </>
                )}
                {routes.length > 0 && (
                  <>
                    <LineBullets routes={routes} size="sm" />
                    {/* The bullets are aria-hidden */}
                    <span className="sr-only">{routes.join(", ")}</span>
                  </>
                )}
                {!isRamp && !isStreet && " trains"}
              </span>
              {caveat && <span className="text-footnote text-muted-foreground text-pretty">{caveat}</span>}
            </span>

            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {status}
                {/* Open rows show the full tip and outage notes right below, so these badges would only repeat them */}
                {elevator.access_note && !isOpen && (
                  <AccessTipBadge />
                )}
                {/* A maintenance label means the upcoming outage is today/tonight/tomorrow — the
                    maintenance badge already says that, so it replaces the generic outage badge */}
                {upcomingOutages.length > 0 && !elevator.maintenanceLabel && !isOpen && (
                  <OutagePlannedBadge isLongTerm={hasLongTermOutage} />
                )}
                {elevator.maintenanceLabel && !(isOpen && upcomingOutages.length > 0) && (
                  <MaintenanceBadge when={elevator.maintenanceLabel} />
                )}
              </span>

              {elevator.ada === "0" && (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-muted-foreground">
                  <span>Not ADA accessible</span>
                </span>
              )}
            </span>
          </span>
        </div>

        {/* 104px wide and the full height of the row, flush to its right edge, photo cropped to fill. Rows
            are at least 104px tall, so one-line rows grow to a square. Opening the row fades it out as
            the full photo grows in below; only opacity and transform animate. Clicking it opens the row,
            but it's not a focus stop: the row already does that, and its status is in the row's text */}
        {elevator.imageURL && (
          <div
            onClick={() => onToggle(true)}
            aria-hidden="true"
            className={cn(
              "absolute cursor-pointer inset-y-0 right-0 w-[104px] origin-top-right overflow-hidden bg-muted transition-[opacity,transform] motion-reduce:transition-none",
              EXPAND_EASE,
              isOpen ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100",
              "before:absolute before:inset-0 before:transition-colors before:duration-150 hover:before:bg-foreground/10 active:before:bg-foreground/20",
            )}
          >
            <img src={elevator.imageURL} alt="" className="size-full object-cover" />
            <ElevatorStatusMark isOut={showsOut} className="right-2 top-2" />
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] motion-reduce:transition-none",
          EXPAND_EASE,
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          id={detailsId}
          ref={detailsRef}
          // Padding lives on the inner wrapper: on this grid item it would hold the collapsed row open
          className={cn(
            "min-h-0 overflow-hidden transition-opacity motion-reduce:transition-none",
            EXPAND_EASE,
            isOpen ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex flex-col gap-3 px-4 pb-4">
          {elevator.access_note && <AccessTipNote note={elevator.access_note} />}
          <PlannedOutageNotes outages={upcomingOutages} maintenanceLabel={elevator.maintenanceLabel} />

          {elevator.imageURL && (
            <div className="relative overflow-hidden rounded-[8px] bg-muted">
              <img src={elevator.imageURL} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <ElevatorStatusMark isOut={showsOut} className="right-3 top-3" />
              {isStreet && elevator.coordinates && (
                <button
                  ref={flyButtonRef}
                  type="button"
                  onClick={() => setActiveFlyButton(isActive ? null : elevator.elevatorno)}
                  // Touch browsers fire synthetic mouseenter/mouseleave around a tap, which would
                  // otherwise immediately undo the click toggle above — hover-capable pointers only
                  onMouseEnter={() => {
                    if (window.matchMedia("(hover: hover)").matches) setActiveFlyButton(elevator.elevatorno);
                  }}
                  onMouseLeave={() => {
                    if (!window.matchMedia("(hover: hover)").matches) return;
                    setActiveFlyButton((current) => (current === elevator.elevatorno ? null : current));
                  }}
                  aria-pressed={isActive}
                  className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 before:absolute before:-inset-y-1.5 before:inset-x-0 py-1.5 pl-2.5 pr-3 text-footnote font-semibold text-foreground shadow-on-photo transition-colors hover:bg-background active:bg-background/80"
                >
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {isActive ? "Showing on map" : "See on map"}
                </button>
              )}
            </div>
          )}

          {elevator.description_custom && (
            <p className="text-subhead text-pretty">{elevator.description_custom}</p>
          )}

          {walkingLink && (
            <a
              href={walkingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-1 text-subhead font-medium underline underline-offset-2 hover:text-muted-foreground"
            >
              Walking directions
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          )}

          <ElevatorFooter elevatorno={elevator.elevatorno} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElevatorCard;
