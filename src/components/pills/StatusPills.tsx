import React from "react";
import { AlertStatus } from "../icons/variants/AlertStatus";
import { cn } from "@/lib/utils";

// Every status pill in the app: colored, tone-driven (ok/partial/out/neutral), built from an
// AlertStatus icon plus text. Two sizes only: `summary` for a station's header, `row` for anything
// inside a list. The legend renders these same components.

export type StatusTone = "ok" | "partial" | "out" | "neutral";
type PillSize = "row" | "summary";

const TONES: Record<StatusTone, { surface: string; icon?: string; glyph?: "check" | "alert" | "out" }> = {
  ok: { surface: "bg-status-ok-muted text-status-ok-foreground", icon: "text-status-ok", glyph: "check" },
  // Some elevators out (isProblem) — a caution, not a shutdown, so it keeps the plain alert glyph
  partial: { surface: "bg-status-partial-muted text-status-partial-foreground", icon: "text-status-partial", glyph: "alert" },
  // Fully out is the one state drawn solid, wherever it appears — same octagon-X glyph used
  // everywhere else for "out of service" (StationMarker, ElevatorMarker, ElevatorStatusMark).
  out: {
    surface: "bg-status-out text-status-out-on",
    icon: "text-status-out-on [--status-icon-glyph:oklch(var(--status-out))]",
    glyph: "out",
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
  // Overrides the tone's default icon — e.g. the "Not ADA accessible" pill reuses tone="out" for
  // its red styling but isn't an outage, so it swaps in AccessibleFalse instead of AlertStatus's "out" glyph
  icon?: React.ReactNode;
}) {
  const t = TONES[tone];
  const s = SIZES[size];
  const defaultIcon = t.glyph && <AlertStatus glyph={t.glyph} className={cn(s.icon, t.icon)} />;
  const hasIcon = icon !== undefined || !!t.glyph;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold",
        s.pill,
        !hasIcon && (size === "row" ? "pl-2" : "pl-3"),
        t.surface,
      )}
    >
      {icon ?? defaultIcon}
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
    // Tailwind's preflight resets every svg to display:block — override so this still flows inline
    // in a non-flex title (e.g. ElevatorCard) instead of forcing the text onto the next line.
    <AlertStatus glyph="out" className={cn("inline size-[1.1em] shrink-0 text-status-out", className)} />
  ) : null;

export const OutOfServicePill = () => <StatusPill tone="out">Out of service</StatusPill>;
