import React from "react";
import { Wrench } from "lucide-react";
import { AccessibleIconWhite } from "../icons";
import { generateSubwayLines } from "@/utils/dataUtils";
import { longtermOutageThreshold } from "../MtaMap/layers/UpcomingOutages/upcomingOutagesProps";
import { UpcomingOutage } from "@/utils/types";

// The detail blocks an elevator shows once opened, shared by the station list row
// and the view that opens from tapping an elevator on the map.

export function AccessTipNote({ note }: { note: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-[#f4c6fb]/50 p-3 text-subhead text-pretty">
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        <AccessibleIconWhite size={16} fill="#6b2177" />
      </span>
      <p>
        <span className="font-semibold">Access tip </span>
        {note}
      </p>
    </div>
  );
}

export function PlannedOutageNotes({ outages }: { outages: UpcomingOutage[] }) {
  return (
    <>
      {outages.map((o, i) => (
        <div key={i} className="flex gap-2.5 rounded-lg bg-status-out-muted p-3 text-subhead text-pretty">
          <Wrench className="mt-0.5 size-4 shrink-0 text-status-out" strokeWidth={2.25} aria-hidden="true" />
          <p>
            <span className="font-semibold">
              {o.outageDurationDays > longtermOutageThreshold ? "Long-term" : "Short-term"} outage planned{" "}
            </span>
            {o.outageDuration} ({o.reason})
          </p>
        </div>
      ))}
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

// Some short descriptions run on ("Street to PATH & subways. Leads to mezzanine via a ramp…"):
// the first sentence is the title, the rest is a caveat set quieter beneath it
export function splitShortDescription(text: string): { title: string; caveat: string } {
  const [first, ...rest] = text.trim().split(/(?<=\.)\s+/);
  return { title: first.replace(/\.$/, ""), caveat: rest.join(" ") };
}
