import React from "react";
import { OctagonX, Wrench } from "lucide-react";
import { AccessibleIconWhite } from "../icons";
import { StatusIcon } from "@/components/StatusIcon/StatusIcon";
import { cn } from "@/lib/utils";

// Every status pill and badge in the app. Two sizes only: `summary` for a station's header,
// `row` for anything inside a list. The legend renders these same components.

export type StatusTone = "ok" | "partial" | "out" | "neutral";
type PillSize = "row" | "summary";

const TONES: Record<StatusTone, { surface: string; icon?: string; glyph?: "check" | "alert" }> = {
  ok: { surface: "bg-status-ok-muted text-status-ok-foreground", icon: "text-status-ok", glyph: "check" },
  partial: { surface: "bg-status-partial-muted text-status-partial-foreground", icon: "text-status-partial", glyph: "alert" },
  // Fully out is the one state drawn solid, wherever it appears
  out: {
    surface: "bg-status-out text-status-out-on",
    icon: "text-status-out-on [--status-icon-glyph:oklch(var(--status-out))]",
    glyph: "alert",
  },
  neutral: { surface: "bg-fill-subtle text-foreground" },
};

const SIZES: Record<PillSize, { pill: string; icon: string }> = {
  row: { pill: "gap-1 py-0.5 pl-1 pr-2 text-caption", icon: "size-3.5" },
  summary: { pill: "gap-1.5 py-1.5 pl-2 pr-3 text-footnote", icon: "size-4" },
};

export function StatusPill({
  tone,
  children,
  size = "row",
  icon,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  size?: PillSize;
  // Overrides the tone's default StatusIcon glyph, e.g. the octagon X used for "out of service"
  // everywhere else on the map and in the station card, instead of the plain alert disc
  icon?: React.ReactNode;
}) {
  const t = TONES[tone];
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold",
        s.pill,
        !t.glyph && !icon && (size === "row" ? "pl-2" : "pl-3"),
        t.surface,
      )}
    >
      {icon ?? (t.glyph && <StatusIcon glyph={t.glyph} className={cn(s.icon, t.icon)} />)}
      {children}
    </span>
  );
}

export const InServicePill = ({ label = "In service" }: { label?: string }) => (
  <StatusPill tone="ok">{label}</StatusPill>
);

// An out-of-service elevator gets the same octagon X as a fully out station on the map, right before its
// title. A working elevator gets nothing. Decorative: pair it with screen-reader text.
export const ElevatorStatusMark = ({ isOut, className }: { isOut: boolean; className?: string }) =>
  isOut ? (
    <OctagonX aria-hidden="true" strokeWidth={2.5} className={cn("size-[1.1em] shrink-0 text-status-out", className)} />
  ) : null;

export const OutOfServicePill = () => <StatusPill tone="out">Out of service</StatusPill>;

// Extra information about an elevator: outlined, so it never competes with the status pill
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
  <Badge icon={<AccessibleIconWhite size={12} fill="oklch(var(--access-tip-foreground))" />}>Access tip</Badge>
);

// Short-term reads as a lower-severity amber; long-term matches the "out of service" red
export const OutagePlannedBadge = ({ isLongTerm }: { isLongTerm?: boolean }) => (
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
