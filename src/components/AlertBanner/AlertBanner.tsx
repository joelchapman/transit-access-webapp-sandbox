import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { StatusIcon } from "@/components/StatusIcon/StatusIcon";
import { AlertData } from "@/types/alerts";
import { cn } from "@/lib/utils";
import { BUTTON_PRESS } from "@/lib/interaction";
import { Note } from "@/components/Note/Note";

const DISMISSED_KEY = "dismissed-system-alerts";

// Severity → note tone, so a good-news banner doesn't look like a warning
const ALERT_TONES = {
  success: { tone: "ok", glyph: "check", icon: "text-status-ok" },
  info: { tone: "info", glyph: "info", icon: "text-muted-foreground" },
  warning: { tone: "partial", glyph: "alert", icon: "text-status-partial [--status-icon-glyph:oklch(var(--status-partial-foreground))]" },
  error: { tone: "out", glyph: "alert", icon: "text-status-out" },
} as const;

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// Dismissals are remembered by alert text, so a new or reworded alert shows again
const AlertBanner: React.FC<{ alerts: AlertData[] }> = ({ alerts }) => {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => setDismissed(readDismissed()), []);

  const dismiss = (text: string) => {
    const next = [...dismissed, text];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: the dismissal just won't survive a reload
    }
  };

  const visible = alerts.filter((alert) => !dismissed.includes(alert.text));
  if (visible.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      {visible.map((alert) => {
        const tone = ALERT_TONES[alert.severity] ?? ALERT_TONES.warning;
        return (
          <Note
            key={alert.text}
            role="status"
            tone={tone.tone}
            icon={<StatusIcon glyph={tone.glyph} className={tone.icon} />}
            action={
              <button
                type="button"
                onClick={() => dismiss(alert.text)}
                aria-label="Dismiss alert"
                className={cn("-my-3 -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground", BUTTON_PRESS)}
              >
                <X className="size-4" />
              </button>
            }
            // Floats over the map
            className="pointer-events-auto shadow-overlay"
          >
            {alert.text}
          </Note>
        );
      })}
    </div>
  );
};

export default AlertBanner;
