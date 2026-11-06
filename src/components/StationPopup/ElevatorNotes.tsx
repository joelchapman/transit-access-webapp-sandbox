import React from "react";
import { Wrench } from "lucide-react";
import { AccessibleIconWhite } from "../icons";
import { longtermOutageThreshold } from "../MtaMap/layers/UpcomingOutages/upcomingOutagesProps";
import { UpcomingOutage } from "@/utils/types";
import { cn } from "@/lib/utils";
import { Note } from "@/components/Note/Note";

// The detail blocks an elevator shows once opened, shared by the station list row
// and the view that opens from tapping an elevator on the map.

export function AccessTipNote({ note }: { note: string }) {
  return (
    <Note
      tone="tip"
      title="Access tip"
      icon={
        <span aria-hidden="true">
          <AccessibleIconWhite size={16} fill="oklch(var(--access-tip-foreground))" />
        </span>
      }
    >
      {note}
    </Note>
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
          <Note
            key={i}
            tone={isImpending ? "out" : "partial"}
            title={`Upcoming ${isLongTerm ? "Long-term" : "Short-term"} Outage`}
            icon={
              <Wrench
                className={cn("size-4", isImpending ? "text-status-out" : "text-status-partial-foreground")}
                strokeWidth={2.25}
                aria-hidden="true"
              />
            }
          >
            {o.outageDuration} ({o.reason})
          </Note>
        );
      })}
    </>
  );
}

export function ElevatorFooter({ elevatorno }: { elevatorno: string }) {
  const isRamp = elevatorno.toLowerCase().includes("ra");
  return (
    <p className="text-footnote tabular-nums text-muted-foreground">
      {isRamp ? "Ramp" : "Elevator"} {elevatorno}
    </p>
  );
}
