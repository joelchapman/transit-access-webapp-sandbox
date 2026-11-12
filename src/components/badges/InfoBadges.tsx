import React from "react";
import { Wrench } from "lucide-react";
import { AccessibleWhite } from "../icons";
import { cn } from "@/lib/utils";

// Access Tips, Maintenance Planned, Redundancy info badges.
// Outlined rather than filled, unlike StatusPills which are filled.

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    // py-px + the 1px border matches a row pill's height
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background py-px pl-1.5 pr-2 text-caption font-semibold text-foreground">
      {icon}
      {children}
    </span>
  );
}

export const AccessTipBadge = () => (
  <Badge icon={<AccessibleWhite size={12} fill="oklch(var(--access-tip-foreground))" />}>Access tip</Badge>
);

// Short-term reads as a lower-severity amber; long-term matches the "out of service" red
export const PlannedOutageBadge = ({ isLongTerm }: { isLongTerm?: boolean }) => (
  <Badge
    icon={<Wrench className={cn("size-3", isLongTerm ? "text-status-out" : "text-status-partial")} strokeWidth={2.5} aria-hidden="true" />}
  >
    Outage planned
  </Badge>
);

export const MaintenanceBadge = ({ when }: { when: string }) => (
  <Badge icon={<Wrench className="size-3 text-status-out" strokeWidth={2.5} aria-hidden="true" />}>Maintenance {when}</Badge>
);

export const RedundantBadge = () => (
  <span className="inline-flex shrink-0 items-center rounded-full bg-status-ok-muted px-2 py-px text-caption font-semibold text-status-ok-foreground">
    Alternate path available
  </span>
);
