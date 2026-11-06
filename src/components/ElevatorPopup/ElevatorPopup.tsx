import React from "react";
import { Wrench } from "lucide-react";
import styles from "./elevator-popup.module.css";
import { ElevatorPopupProps } from "@/utils/types";
import {
  ElevatorStatusMark,
  InServicePill,
  OutOfServicePill,
  MaintenanceBadge,
} from "@/components/StationPopup/StatusBadges";
import {
  AccessTipNote,
  PlannedOutageNotes,
  ElevatorFooter,
} from "@/components/StationPopup/ElevatorNotes";
import { LineBullets } from "@/components/LineBullets/LineBullets";

// Opens when an elevator is tapped on the map: the same elevator as a station-list row, opened,
// so it uses the row's title rule, pills, badges and detail blocks.

const toBool = (v: unknown) => v === true || v === "true" || v === "1";

const ElevatorPopup: React.FC<ElevatorPopupProps> = ({
  title: stationName,
  elevatorno,
  imageURL,
  description_custom,
  linesServed,
  estimatedreturntoservice,
  isStreet,
  isOut,
  access_note,
  shortdescription,
  isUpcomingOutage,
  maintenanceLabel,
  lastUpdated,
}) => {
  const lines = (linesServed || "").replace(/-/g, "").replaceAll("/", " ");
  const routes = lines.split(" ").filter(Boolean);
  const isRamp = elevatorno.toLowerCase().includes("ra");
  const out = toBool(isOut) && !isRamp;
  const upcoming = isUpcomingOutage ?? [];
  const eta = estimatedreturntoservice?.replace(/^(Today|Tomorrow)\b/, (w) => w.toLowerCase());
  // shortdescription is unreliable (not curated for display) — generate the title instead
  const title = isRamp ? "Ramp" : toBool(isStreet) ? "Street elevator" : "Platform elevator";
  // shortdescription shown as a quiet always-visible note, ahead of the real access_note
  // (which AccessTipNote shows below)
  const caveat = shortdescription;

  return (
    <section className="flex flex-col gap-3 px-4 pb-4" aria-labelledby="elevator-popup-title">
      <header className="flex flex-col gap-1">
        <p className="text-subhead text-muted-foreground">{stationName}</p>
        <h1 id="elevator-popup-title" className="flex flex-wrap items-center gap-1.5 text-title text-balance">
          <ElevatorStatusMark isOut={out} />
          {title}
          {routes.length > 0 && (
            <>
              <LineBullets routes={routes} size="sm" animated={false} />
              {/* The bullets are aria-hidden */}
              <span className="sr-only">{routes.join(", ")}</span>
            </>
          )}
        </h1>
        {caveat && <p className="text-footnote text-muted-foreground text-pretty">{caveat}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* With a photo, the octagon X before the title marks an outage. Screen readers get the words either way */}
          {imageURL ? (
            <span className="sr-only">{out ? "Out of service" : isRamp ? "Always in service" : "In service"}</span>
          ) : out ? (
            <OutOfServicePill />
          ) : (
            <InServicePill label={isRamp ? "Always in service" : "In service"} />
          )}
          {out && eta && <span className="text-footnote text-status-out-foreground">Back {eta}</span>}
          {/* The outage notes below already give the timing */}
          {maintenanceLabel && upcoming.length === 0 && <MaintenanceBadge when={maintenanceLabel} />}
        </div>
      </header>

      {imageURL && (
        <div className="relative">
          <img src={imageURL} alt="" className="aspect-[4/3] w-full rounded-[8px] object-cover" />
        </div>
      )}
      {access_note && <AccessTipNote note={access_note} />}
      <PlannedOutageNotes outages={upcoming} maintenanceLabel={maintenanceLabel} />
      {description_custom && <p className="text-subhead text-pretty">{description_custom}</p>}
      <ElevatorFooter elevatorno={elevatorno} />
      {lastUpdated && (
        <p className="text-footnote text-muted-foreground">
          Last updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </section>
  );
};

export default ElevatorPopup;

interface OnHoverElevatorPopupProps {
  date: string;
  reason: string;
  isStreet: string;
  station: string;
}

export const OnHoverElevatorPopup: React.FC<OnHoverElevatorPopupProps> = ({
  date, reason, isStreet, station
}) => {

  return (
    <>
    <div className={styles.upcoming}>
        <div className={styles.upcomingHeader}><Wrench className="size-5" strokeWidth={2.25} aria-hidden="true" /><strong>Long-term outage coming up</strong></div>
        {isStreet ? "Street Elevator" : "Platform Elevator"} at <div className={styles.popupSubtitle}>{station}</div>
      <div className={styles.date}>Starting {date}</div>
      </div>
    </>
  );
};
