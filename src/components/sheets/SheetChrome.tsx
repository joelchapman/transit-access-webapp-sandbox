import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawerTitle } from "@/components/ui/drawer";
import { RAISED_BUTTON } from "@/lib/interaction";
import { cn } from "@/lib/utils";

// A collapsed sheet's content sits below the screen, so keyboard focus must not land in it
export const COLLAPSED_PROPS = { inert: "" } as object;

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Marks the top edge of a scroll area once content has slid under the header above it. Scroll
// events don't bubble, so this catches them on the way down; the height check skips sideways
// scrollers inside, like the distance chips.
export function ScrollEdge({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onScrollCapture={(e) => {
        const el = e.target as HTMLElement;
        if (el.scrollHeight > el.clientHeight) setIsScrolled(el.scrollTop > 0);
      }}
    >
      {children}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-2 border-t border-border bg-gradient-to-b from-fill-subtle to-transparent transition-opacity duration-150 motion-reduce:transition-none",
          isScrolled ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

// The chrome around whatever page content is pushed onto the sheet (station details, the Legend):
// a back button, focus trap, and scroll-edge shadow. It's framing, not content — it doesn't
// contain a page itself. isDesktop skips vaul's DrawerTitle (it needs a <Drawer> context that the
// desktop panel, rendered outside one, doesn't have) in favor of a plain heading.
export function SheetChrome({
  label,
  onBack,
  scrollable,
  endPadding,
  isDesktop,
  hasScrollEdge = false,
  children,
}: {
  label: string;
  onBack: () => void;
  scrollable: boolean;
  endPadding: React.CSSProperties;
  isDesktop: boolean;
  // Station pages leave this off: their pinned title marks the edge itself
  hasScrollEdge?: boolean;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Whatever had focus before this page opened (almost always the search input, since cmdk
  // keeps real focus there even while arrow keys "select" a row) gets it back once this page
  // closes — otherwise closing drops focus to <body> and a keyboard user has to re-Tab from
  // the top of the document to get back to where they were.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => previouslyFocused?.focus?.();
  }, []);

  // The sheet is deliberately non-modal (map clicks/zoom still work behind it), but keyboard
  // users still need a way out: Escape always closes, and Tab wraps within this page instead of
  // escaping into whatever's behind it on the map (there's no visual indication it even left).
  // Elements are re-queried on every Tab press since opening/closing a row changes what's focusable.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }
      if (e.key !== "Tab" || !rootRef.current) return;
      const focusable = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const scroller = (
    <div
      {...(scrollable ? {} : COLLAPSED_PROPS)}
      className={cn(
        "min-h-0 flex-1 overscroll-contain",
        scrollable ? "overflow-y-auto" : "overflow-hidden",
      )}
      style={endPadding}
    >
      {children}
    </div>
  );
  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      {isDesktop ? <h2 className="sr-only">{label}</h2> : <DrawerTitle className="sr-only">{label}</DrawerTitle>}
      {/* The visible buttons sit 4px inside their tap areas, so desktop's pt-3 and the px-3 put them 16px from the panel's edges */}
      <div className={cn("flex items-center justify-between px-3 pb-1", isDesktop && "pt-3")}>
        <Button
          variant="ghost"
          onClick={onBack}
          className={cn("h-11 gap-0.5 rounded-full pl-3 pr-[18px] text-body font-normal text-foreground", RAISED_BUTTON)}
        >
          <ChevronLeft className="size-6" />
          Stations
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Close"
          className={cn("size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground", RAISED_BUTTON)}
        >
          <X className="size-5" />
        </Button>
      </div>
      {hasScrollEdge ? <ScrollEdge>{scroller}</ScrollEdge> : scroller}
    </div>
  );
}

export default SheetChrome;
