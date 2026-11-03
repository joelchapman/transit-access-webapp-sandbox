import React from "react";
import { ElevatorMarker, ElevatorMarkerInverted } from "@/components/ElevatorMarker/ElevatorMarker";
import { StationMarker } from "@/components/StationMarker/StationMarker";
import { Ramp, AccessibleIconWhite } from "../icons";
import {
  AccessTipBadge,
  OutagePlannedBadge,
  InServicePill,
  OutOfServicePill,
  MaintenanceBadge,
  RedundantBadge,
} from "@/components/StationPopup/StatusBadges";
import { getADAPctByComplex } from "@/utils/dataUtils";
import { COMMUNITY_LINKS } from "@/utils/constants";
import pkg from "../../../package.json";

// Mirrors the old LegendDrawer's content/structure and wording as closely as this page
// format allows — only the icons/badges are the updated ones from the current design.

interface LegendPageProps {
  numOutElevators: number;
  totalElevators: number;
  lastUpdated: Date | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 px-4 pt-8">
      <h2 className="text-headline font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[65ch] text-body leading-relaxed text-pretty">{children}</p>;
}

// A number called out inline — bold italic with a thin stroke, like the old legend's counts
function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-black italic tabular-nums" style={{ WebkitTextStroke: "0.5px currentColor" }}>
      {children}
    </span>
  );
}

// A symbol beside its meaning, in a fixed 28px column so the text lines up down the list
function SymbolList({ items }: { items: { symbol: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {items.map(({ symbol, text }, i) => (
        <div key={i} className="flex items-start gap-3">
          <dt className="grid size-7 shrink-0 place-items-center" aria-hidden="true">
            {symbol}
          </dt>
          <dd className="pt-0.5 text-subhead text-pretty">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

// Badges are wider than a symbol column, so each sits above its explanation
function BadgeList({ items }: { items: { badge: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map(({ badge, text }, i) => (
        <div key={i} className="flex flex-col items-start gap-1.5">
          <dt>{badge}</dt>
          <dd className="text-subhead text-pretty">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

const LegendPage: React.FC<LegendPageProps> = ({ numOutElevators, totalElevators, lastUpdated }) => {
  const numInService = totalElevators - numOutElevators;
  const pctOut = totalElevators > 0 ? Math.round((numOutElevators / totalElevators) * 100) : 0;
  const pctAccessible = getADAPctByComplex();
  const updatedAt = lastUpdated?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <article className="pb-2">
      <header className="px-4">
        {/* Literal translation of the old MUI sx values — the logo is intentionally oversized
            and shifted up/left, bleeding past this box's edges (no overflow-hidden/clip here,
            same as the old version), with the title layered on top of it. */}
        <div className="relative" style={{ width: 240, height: 110 }}>
          <img
            src="/transitaccesslogo.png"
            alt=""
            aria-hidden="true"
            className="absolute object-contain object-left"
            style={{ width: "100%", top: -65, left: -10 }}
          />
          <h1 className="absolute flex flex-col justify-center" style={{ top: 45, left: 60, fontWeight: 700, fontSize: 25, lineHeight: 1 }}>
            <span className="ml-1" aria-hidden="true">
              <AccessibleIconWhite />
            </span>
            Transit Access
          </h1>
        </div>
        <p className="mt-1 text-subhead text-muted-foreground">
          This map shows live elevator status in the NYC subway system. Tap on a station for more info!
        </p>
      </header>

      <Section title="Live Summary">
        {/* aria-live so screen readers hear refreshed counts without being interrupted */}
        <div aria-live="polite" aria-atomic="true">
          <Prose>
            {lastUpdated ? (
              <>
                There are <Stat>{numOutElevators}</Stat> elevators out of service at this time ({pctOut}% of
                the system).
              </>
            ) : (
              "Loading live status…"
            )}
          </Prose>
          {lastUpdated && (
            <Prose>
              <Stat>{numInService}</Stat> elevators available for use.
            </Prose>
          )}
          {updatedAt && <p className="text-footnote text-muted-foreground">Last updated: {updatedAt}</p>}
        </div>
      </Section>

      <Section title="Map Legend">
        <SymbolList
          items={[
            { symbol: <StationMarker access="ok" size={28} />, text: "All elevators in service." },
            { symbol: <StationMarker access="partial" size={28} />, text: "At least one elevator out of service." },
            { symbol: <StationMarker access="out" size={28} />, text: "All elevators out of service." },
            { symbol: <StationMarker access="none" size={28} />, text: "Station not ADA accessible." },
          ]}
        />
      </Section>

      <Section title="Station Legend">
        <SymbolList
          items={[
            { symbol: <ElevatorMarker state="ok" size={28} />, text: "Street elevator (exact location shown on map)." },
            { symbol: <ElevatorMarkerInverted state="ok" size={28} />, text: "Platform elevator" },
            { symbol: <Ramp size={28} />, text: "Ramp." },
          ]}
        />
      </Section>

      <Section title="Elevator Legend">
        <BadgeList
          items={[
            { badge: <InServicePill />, text: "Working now." },
            {
              badge: <OutOfServicePill />,
              text: "Not working. Return time estimated by MTA.",
            },
            { badge: <RedundantBadge />, text: "If out of service, another path is possible." },
            { badge: <AccessTipBadge />, text: "Access tip from the community." },
            { badge: <OutagePlannedBadge />, text: "Future outage planned." },
            {
              badge: <MaintenanceBadge when="today" />,
              text: "Maintenance today or tomorrow.",
            },
          ]}
        />
      </Section>

      <Section title="General Accessibility Notes">
        <Prose>
          {pctAccessible < 75 ? "Only " : ""}
          <Stat>{pctAccessible}%</Stat> of stations in the MTA are ADA
          accessible. Use Transit Access to check if your accessible station is in service.
        </Prose>
        <Prose>
          The MTA is taking elevators out of service for replacement for 8–12 months at a time. Use Transit
          Access to stay ready and up-to-date.
        </Prose>
        <Prose>
          Mobility devices board in the middle of the platform. Look for the conductor and the blue Boarding
          Area sign.
        </Prose>
        <img
          src="/boardingarea.png"
          alt="A blue Boarding Area sign mounted on the ceiling of a subway platform, indicating where mobility device users should wait to board"
          className="w-full rounded-lg"
        />
      </Section>

      <Section title="About">
        <Prose>
          Version {pkg.version}
          <br />© {new Date().getFullYear()} Transit Access LLC
          <br />
          Built by Joel Chapman &amp; Prachi Kulkarni
        </Prose>

        <a
          href="https://www.buymeacoffee.com/transitaccess"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy Me A Coffee — support Transit Access (opens in new tab)"
          className="w-fit"
        >
          <img
            alt=""
            src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
            className="h-10 w-auto"
          />
        </a>

        {/* Buy Me A Coffee keeps its logo button above; everything else is a plain link */}
        <ul className="flex flex-col gap-1">
          {COMMUNITY_LINKS.filter((link) => !link.href.includes("buymeacoffee")).map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noreferrer"
                className="text-body underline underline-offset-2 hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <p className="max-w-[65ch] text-footnote text-pretty text-muted-foreground">
          Disclaimer: App data pulled from MTA’s GTFS-realtime feed and{" "}
          <a href="https://data.ny.gov" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Open Data NY
          </a>
          . Accuracy is highly dependent on the data provided. If you suspect any inaccuracies, check MTA’s
          website for official notices at{" "}
          <a href="https://mta.info" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            mta.info
          </a>
          .
        </p>
      </Section>
    </article>
  );
};

export default LegendPage;
