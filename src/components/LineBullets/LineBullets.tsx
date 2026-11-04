import React from "react";
import { MTA_SUBWAY_LINE_ICONS_SMALL } from "@/utils/constants";
import { cn } from "@/lib/utils";

// --fan is how far each bullet slides to undo its overlap (overlap + a 2px gap). Touch screens can't
// hover to fan out, so their stacks overlap 2px less.
const SIZES = {
  xs: "size-4 [&:not(:first-child)]:-ml-[5px] [@media(hover:none)]:[&:not(:first-child)]:-ml-[3px] [--fan:6px]",
  sm: "size-[22px] [&:not(:first-child)]:-ml-[7px] [@media(hover:none)]:[&:not(:first-child)]:-ml-[5px] [--fan:9px]",
  md: "size-6 [&:not(:first-child)]:-ml-2 [@media(hover:none)]:[&:not(:first-child)]:-ml-1.5 [--fan:10px]",
  lg: "size-8 [&:not(:first-child)]:-ml-2.5 [@media(hover:none)]:[&:not(:first-child)]:-ml-2 [--fan:12px]",
};

// Bullets overlap like a stack and fan out when the stack (or a parent `group/row`) is hovered.
// Each slides by its index × --fan with transform, so nothing around it reflows.
// Hover-capable pointers only, so taps don't jitter.
const FAN_OUT =
  "[@media(hover:hover)]:group-hover/lines:translate-x-[calc(var(--i)*var(--fan))] [@media(hover:hover)]:group-hover/row:translate-x-[calc(var(--i)*var(--fan))]";

interface LineBulletsProps {
  routes: string[];
  size?: keyof typeof SIZES;
  className?: string;
  // Off for rows where the fan-out would be distracting (e.g. a compact out-of-service sublist)
  animated?: boolean;
}

export function LineBullets({ routes, size = "md", className, animated = true }: LineBulletsProps) {
  return (
    <span
      className={cn("group/lines inline-flex shrink-0 items-center align-middle", className)}
      aria-hidden="true"
    >
      {routes.map((route, i) => (
        <span
          key={route}
          style={{ "--i": i } as React.CSSProperties}
          className={cn(
            "relative grid shrink-0 place-items-center rounded-full bg-background ring-[1.5px] ring-background transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none [&_svg]:size-full",
            SIZES[size],
            animated && FAN_OUT,
          )}
        >
          {MTA_SUBWAY_LINE_ICONS_SMALL[route] ?? (
            <span className="text-caption font-bold">{route}</span>
          )}
        </span>
      ))}
    </span>
  );
}

export default LineBullets;
