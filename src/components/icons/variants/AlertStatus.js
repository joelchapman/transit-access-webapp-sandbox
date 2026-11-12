import { OctagonX } from "lucide-react";
import { cn } from "@/lib/utils";

// 4 variants: check, alert, info, & out. Usage: <AlertStatus glyph="alert" className="size-5 text-status-partial" />
// "out" is the one glyph not drawn as a disc — it's lucide's own octagon-X shape, used wherever a
// status is fully out (always on a solid-colored surface already, so it doesn't need its own disc
// background the way check/alert/info do).
const DISC = <circle cx="8" cy="8" r="8" fill="currentColor" />;

const ICONS = {
  check: (
    <>
      {DISC}
      <path d="M4.75 8.25 7 10.5l4.25-4.75" fill="none" stroke="var(--status-icon-glyph, white)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  alert: (
    <>
      {DISC}
      <rect x="7.1" y="3.75" width="1.8" height="5.5" rx="0.9" fill="var(--status-icon-glyph, white)" />
      <circle cx="8" cy="11.6" r="1.05" fill="var(--status-icon-glyph, white)" />
    </>
  ),
  info: (
    <>
      {DISC}
      <circle cx="8" cy="4.6" r="1.05" fill="var(--status-icon-glyph, white)" />
      <rect x="7.1" y="6.75" width="1.8" height="5.5" rx="0.9" fill="var(--status-icon-glyph, white)" />
    </>
  ),
};

/** @param {{ glyph: "check" | "alert" | "info" | "out", className?: string }} props */
export function AlertStatus({ glyph, className }) {
  if (glyph === "out") {
    return <OctagonX aria-hidden="true" strokeWidth={2.5} className={className} />;
  }
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} aria-hidden="true">
      {ICONS[glyph]}
    </svg>
  );
}

export default AlertStatus;
