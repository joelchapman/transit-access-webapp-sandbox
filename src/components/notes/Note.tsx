import React from "react";
import { cn } from "@/lib/utils";

// Every notification block in the app — access tips, planned outages, station and system alerts —
// shares this shape: a tinted card, a semibold title with its icon on the right, then the message.
// Tone picks the tint; the surface-* classes re-point muted text, borders and hover tints to it.
const TONES = {
  tip: "bg-access-tip",
  ok: "bg-status-ok-muted",
  info: "bg-muted",
  partial: "surface-partial bg-status-partial-muted",
  out: "surface-out bg-status-out-muted",
} as const;

export type NoteTone = keyof typeof TONES;

export function Note({
  tone,
  title,
  icon,
  action,
  role,
  className,
  children,
}: {
  tone: NoteTone;
  // Omit for a plain icon + message row, no header (e.g. a system alert that doesn't need a label)
  title?: React.ReactNode;
  // Decorative: hide it from screen readers
  icon: React.ReactNode;
  // Sits after the icon, e.g. a dismiss button
  action?: React.ReactNode;
  role?: React.AriaRole;
  className?: string;
  children: React.ReactNode;
}) {
  if (!title) {
    return (
      <div role={role} className={cn("flex items-start gap-3 rounded-[8px] p-3 text-subhead text-pretty", TONES[tone], className)}>
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {icon}
        </span>
        <p className="min-w-0 flex-1">{children}</p>
        {action}
      </div>
    );
  }

  return (
    <div role={role} className={cn("flex flex-col gap-1 rounded-[8px] p-3 text-subhead text-pretty", TONES[tone], className)}>
      <div className="flex items-center justify-between gap-2.5">
        <p className="font-semibold">{title}</p>
        <span className="flex shrink-0 items-center">
          {icon}
          {action}
        </span>
      </div>
      <p>{children}</p>
    </div>
  );
}
