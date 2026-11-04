// Shared hover/press feedback so every tappable surface in the sheet responds the same way.
// Tints are foreground at low alpha, so they read on white rows and on the pink out-of-service rows alike.

/** Full-width list rows */
export const ROW_PRESS =
  "transition-colors duration-150 hover:bg-foreground/[0.04] active:bg-foreground/[0.08]";

/** Round icon and text buttons */
export const BUTTON_PRESS =
  "transition-colors duration-150 hover:bg-foreground/[0.08] active:bg-foreground/[0.12]";

/**
 * Sheet header buttons: a raised surface drawn 4px inside the 44px hit target, so the visible
 * circle or pill is 36px tall. Behind the content via isolate + -z-10.
 */
export const RAISED_BUTTON =
  "relative isolate hover:bg-transparent before:absolute before:inset-1 before:-z-10 before:rounded-full before:bg-background before:shadow-raised before:transition-colors before:duration-150 hover:before:bg-foreground/[0.04] active:before:bg-foreground/[0.08]";

/** Opening and closing rows: a quick start that settles gently (iOS sheet curve) */
export const EXPAND_EASE = "ease-[cubic-bezier(0.32,0.72,0,1)] duration-[250ms]";
