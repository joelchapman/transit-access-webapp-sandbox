import React from "react";
import { Wrench } from "lucide-react";
import { AccessibleIconWhite } from "../icons";
import { generateSubwayLines } from "@/utils/dataUtils";
import { longtermOutageThreshold } from "../MtaMap/layers/UpcomingOutages/upcomingOutagesProps";
import { UpcomingOutage } from "@/utils/types";
import { cn } from "@/lib/utils";

// The detail blocks an elevator shows once opened, shared by the station list row
// and the view that opens from tapping an elevator on the map.

export function AccessTipNote({ note }: { note: string }) {
  return (
    <div className="flex justify-between gap-2.5 rounded-[8px] bg-access-tip p-3 text-subhead text-pretty">
      <p>
        <span className="font-semibold">Access tip </span>
        {note}
      </p>
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        <AccessibleIconWhite size={16} fill="oklch(var(--access-tip-foreground))" />
      </span>
    </div>
  );
}

export function PlannedOutageNotes({
  outages,
  maintenanceLabel,
}: {
  outages: UpcomingOutage[];
  // Present when the outage starts today/tonight/tomorrow — impending, not just long-term,
  // so it gets the same red treatment even if it's a short one
  maintenanceLabel?: string | null;
}) {
  return (
    <>
      {outages.map((o, i) => {
        const isLongTerm = o.outageDurationDays > longtermOutageThreshold;
        const isImpending = isLongTerm || !!maintenanceLabel;
        return (
          <div
            key={i}
            className={cn(
              "flex justify-between gap-2.5 rounded-[8px] p-3 text-subhead text-pretty",
              isImpending ? "bg-status-out-muted" : "bg-status-partial-muted",
            )}
          >
            <p>
              <span className="font-semibold">
                Upcoming {isLongTerm ? "Long-term" : "Short-term"} Outage{" "}
              </span>
              {o.outageDuration} ({o.reason})
            </p>
            <Wrench
              className={cn("mt-0.5 size-4 shrink-0", isImpending ? "text-status-out" : "text-status-partial")}
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </>
  );
}

export function ElevatorFooter({
  elevatorno,
  lines,
  ada,
}: {
  elevatorno: string;
  lines: string;
  ada?: string;
}) {
  const isRamp = elevatorno.toLowerCase().includes("ra");
  return (
    <div className="flex items-center justify-between gap-3 text-footnote tabular-nums text-muted-foreground">
      <span>
        {isRamp ? "Ramp" : "Elevator"} {elevatorno}
      </span>
      {lines && <span className="flex items-center">{generateSubwayLines(lines, "small", ada, false, {})}</span>}
    </div>
  );
}
