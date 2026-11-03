import React, { useEffect, useRef } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";

import { InServicePill, OutOfServicePill, AccessTipBadge, OutagePlannedBadge, MaintenanceBadge, RedundantBadge } from "./StatusBadges";
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

  // shortdescription is unreliable (not curated for display) — generate the title instead
  const titleText = isRamp
    ? "Ramp"
    : isStreet
      ? "Street elevator"
      : `Elevator to ${elevator.isBridge ? "overpass to " : ""}${elevator.isMezzTransferOnly ? "lower mezzanine to " : ""}${lines.split(" ").join("/")} trains`;
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

  // Same pills as the station summary: quiet teal when it works, solid red when it doesn't
  const status = isOut && !isRamp ? (
    <>
      <span className="flex items-center gap-1">
        <OutOfServicePill />
        {toBool(elevator.isRedundant) && <RedundantBadge />}
      </span>
      {eta && <span className="text-footnote text-status-out-foreground">Back {eta}</span>}
    </>
  ) : (
    <InServicePill label={isRamp ? "Always in service" : "In service"} />
  );

  return (
    <div ref={rootRef} className="flex scroll-mt-2 flex-col">
      <div className="relative">
        {/* A div, not a button: the access-tip/outage badges inside need to be real,
            independently-focusable <button>s, which can't nest inside one */}
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
            "flex w-full min-w-0 cursor-pointer items-stretch py-3 pl-4 text-left",
            ROW_PRESS,
            // Room for the thumbnail while it's showing; snaps (not animated) so text reflows once
            elevator.imageURL && !isOpen ? "min-h-[104px] pr-[116px]" : "pr-4",
          )}
        >
          {/* Fills the row's height: title at the top, status pinned to the bottom, lining up with the photo */}
          <span className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-1.5 text-headline font-semibold text-pretty">
                {isRamp ? (
                  "Ramp"
                ) : isStreet ? (
                  <>
                    Street elevator
                    {lines && <LineBullets routes={lines.split(" ").filter(Boolean)} size="sm" />}
                  </>
                ) : (
                  <>
                    Elevator to {elevator.isBridge ? "overpass to " : ""}
                    {elevator.isMezzTransferOnly ? "lower mezzanine to " : ""}
                    {lines && <LineBullets routes={lines.split(" ").filter(Boolean)} size="sm" />}
                    {" "}trains
                  </>
                )}
              </span>
              {caveat && <span className="text-footnote text-muted-foreground text-pretty">{caveat}</span>}
            </span>

            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {status}
                {elevator.access_note && (
                  <AccessTipBadge
                    onClick={isOpen ? undefined : (e) => { e.stopPropagation(); onToggle(true); }}
                    aria-label={isOpen ? undefined : "Show access tip"}
                  />
                )}
                {/* A maintenance label means the upcoming outage is today/tonight/tomorrow — the
                    maintenance badge already says that, so it replaces the generic outage badge */}
                {upcomingOutages.length > 0 && !elevator.maintenanceLabel && (
                  <OutagePlannedBadge
                    isLongTerm={hasLongTermOutage}
                    onClick={isOpen ? undefined : (e) => { e.stopPropagation(); onToggle(true); }}
                    aria-label={isOpen ? undefined : "Show planned outage"}
                  />
                )}
                {elevator.maintenanceLabel && <MaintenanceBadge when={elevator.maintenanceLabel} />}
              </span>

              {elevator.ada === "0" && (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-muted-foreground">
                  <span>Not ADA accessible</span>
                </span>
              )}
            </span>
          </span>
        </div>

        {/* A 104px square on every row, flush to the top and right edges, photo cropped to fill. Rows
            are at least that tall, so one-line rows grow to meet it. Opening the row fades it out as
            the full photo grows in below; only opacity and transform animate */}
        {elevator.imageURL && (
          <button
            type="button"
            onClick={() => onToggle(true)}
            aria-label={`Show photo of ${titleText.toLowerCase()}`}
            aria-controls={detailsId}
            tabIndex={isOpen ? -1 : undefined}
            aria-hidden={isOpen || undefined}
            className={cn(
              "absolute right-0 top-0 size-[104px] origin-top-right overflow-hidden bg-muted transition-[opacity,transform] motion-reduce:transition-none",
              EXPAND_EASE,
              isOpen ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100",
              "after:absolute after:inset-0 after:transition-colors after:duration-150 hover:after:bg-black/10 active:after:bg-black/20",
            )}
          >
            <img src={elevator.imageURL} alt="" className="size-full object-cover" />
          </button>
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
            <div className="relative overflow-hidden rounded-lg bg-muted">
              <img src={elevator.imageURL} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
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
                  className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 py-1.5 pl-2.5 pr-3 text-footnote font-semibold text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.12),0_2px_8px_oklch(0_0_0/0.12)] transition-colors hover:bg-white active:bg-white/80"
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
              className="inline-flex w-fit items-center gap-1 text-subhead font-medium underline underline-offset-2 hover:text-muted-foreground"
            >
              Walking directions
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          )}

          <ElevatorFooter elevatorno={elevator.elevatorno} lines={lines} ada={elevator.ada} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElevatorCard;
