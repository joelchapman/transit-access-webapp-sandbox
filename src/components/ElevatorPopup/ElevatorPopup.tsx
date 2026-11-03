import React from "react";
import { Wrench } from "lucide-react";
import styles from "./elevator-popup.module.css";
import { ElevatorPopupProps } from "@/utils/types";
import {
  InServicePill,
  OutOfServicePill,
  AccessTipBadge,
  OutagePlannedBadge,
  MaintenanceBadge,
} from "@/components/StationPopup/StatusBadges";
import {
  AccessTipNote,
  PlannedOutageNotes,
  ElevatorFooter,
} from "@/components/StationPopup/ElevatorNotes";
import { LineBullets } from "@/components/LineBullets/LineBullets";
import { longtermOutageThreshold } from "@/components/MtaMap/layers/UpcomingOutages/upcomingOutagesProps";

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
  ada,
}) => {
  const lines = (linesServed || "").replace(/-/g, "").replaceAll("/", " ");
  const isRamp = elevatorno.toLowerCase().includes("ra");
  const out = toBool(isOut) && !isRamp;
  const upcoming = isUpcomingOutage ?? [];
  const hasLongTermOutage = upcoming.some((o) => o.outageDurationDays > longtermOutageThreshold);
  const eta = estimatedreturntoservice?.replace(/^(Today|Tomorrow)\b/, (w) => w.toLowerCase());
  // shortdescription is unreliable (not curated for display) — generate the title instead
  const title = isRamp ? "Ramp" : toBool(isStreet) ? "Street elevator" : "Platform elevator";
  // shortdescription shown as a quiet always-visible note, ahead of the real access_note
  // (which stays behind the AccessTipBadge/AccessTipNote, revealed below)
  const caveat = shortdescription;

  return (
    <section className="flex flex-col gap-3 px-4 pb-4" aria-labelledby="elevator-popup-title">
      <header className="flex flex-col gap-1">
        <p className="text-subhead text-muted-foreground">{stationName}</p>
        <h1 id="elevator-popup-title" className="flex flex-wrap items-center gap-1.5 text-title text-balance">
          {title}
          {!isRamp && lines && <LineBullets routes={lines.split(" ").filter(Boolean)} size="sm" />}
        </h1>
        {caveat && <p className="text-footnote text-muted-foreground text-pretty">{caveat}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {out ? <OutOfServicePill /> : <InServicePill label={isRamp ? "Always in service" : "In service"} />}
          {out && eta && <span className="text-footnote text-status-out-foreground">Back {eta}</span>}
          {access_note && <AccessTipBadge />}
          {upcoming.length > 0 && !maintenanceLabel && <OutagePlannedBadge isLongTerm={hasLongTermOutage} />}
          {maintenanceLabel && <MaintenanceBadge when={maintenanceLabel} />}
        </div>
      </header>

      {imageURL && <img src={imageURL} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />}
      {access_note && <AccessTipNote note={access_note} />}
      <PlannedOutageNotes outages={upcoming} maintenanceLabel={maintenanceLabel} />
      {description_custom && <p className="text-subhead text-pretty">{description_custom}</p>}
      <ElevatorFooter elevatorno={elevatorno} lines={lines} ada={ada} />
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
