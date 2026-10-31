import React from "react";
import { ElevatorMarker, ElevatorPlannedBadge } from "@/components/ElevatorMarker/ElevatorMarker";
import { StationMarker } from "@/components/StationMarker/StationMarker";
import {
  InServicePill,
  OutOfServicePill,
  AccessTipBadge,
  OutagePlannedBadge,
  MaintenanceBadge,
} from "@/components/StationPopup/StatusBadges";
import { getADAPctByComplex } from "@/utils/dataUtils";
import { longtermOutageThreshold } from "@/components/MtaMap/layers/UpcomingOutages/upcomingOutagesProps";
import pkg from "../../../package.json";

// Reads as a short article: what the live numbers mean, how to read the map and a station's page,
// then practical notes. Symbols are the real map icons and the same badges the station page renders.

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
  const pctAccessible = getADAPctByComplex();
  const updatedAt = lastUpdated?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <article className="pb-2">
      <header className="px-4">
        <h1 className="text-title">Legend</h1>
        <p className="mt-1 text-subhead text-muted-foreground">
          Live elevator status for the NYC subway, and how to read it.
        </p>
      </header>

      <Section title="Live status">
        {/* aria-live so screen readers hear refreshed counts without being interrupted */}
        <div className="grid grid-cols-2 gap-4" aria-live="polite" aria-atomic="true">
          <div>
            <div className="text-stat tabular-nums text-status-partial-foreground">
              {lastUpdated ? numOutElevators : "–"}
            </div>
            <div className="mt-1.5 text-subhead text-muted-foreground">Out of service</div>
          </div>
          <div>
            <div className="text-stat tabular-nums">
              {lastUpdated ? numInService : "–"}
            </div>
            <div className="mt-1.5 text-subhead text-muted-foreground">In service</div>
          </div>
        </div>
        <p className="text-footnote tabular-nums text-muted-foreground">
          {lastUpdated ? `Across ${totalElevators} elevators. Updated ${updatedAt}.` : "Loading live status…"}
        </p>
      </Section>

      <Section title="Reading the map">
        <Prose>Each accessible station shows how its elevators are doing right now.</Prose>
        <SymbolList
          items={[
            { symbol: <StationMarker access="ok" size={28} />, text: "Every elevator is working." },
            { symbol: <StationMarker access="partial" size={28} />, text: "At least one elevator is out of service." },
            { symbol: <StationMarker access="out" size={28} />, text: "Every elevator is out, so there’s no step-free access right now." },
            { symbol: <StationMarker access="none" size={28} />, text: "The station has no step-free access." },
          ]}
        />
        <Prose>Zoom in and each station becomes a white capsule, with its street elevators drawn where their entrances are.</Prose>
        <SymbolList
          items={[
            { symbol: <ElevatorMarker state="ok" size={28} />, text: "A street elevator that’s working." },
            { symbol: <ElevatorMarker state="out" size={28} />, text: "A street elevator that’s out of service." },
            {
              symbol: <ElevatorPlannedBadge size={18} />,
              text: `On an elevator’s corner: a long-term outage is coming up, more than ${longtermOutageThreshold} days.`,
            },
          ]}
        />
      </Section>

      <Section title="On a station’s page">
        <Prose>
          Elevators are grouped by where they start: at street level or inside the station. Tap one to see
          its photo, where it goes, and any notes.
        </Prose>
        <BadgeList
          items={[
            { badge: <InServicePill />, text: "Working now. Ramps always show as in service." },
            {
              badge: <OutOfServicePill />,
              text: "Not working. When the MTA gives a return time, it shows beside this. If another elevator covers the same route, the row says so.",
            },
            {
              badge: <AccessTipBadge />,
              text: "A note from the Transit Access community, like a steep ramp to avoid or which entrance is closest.",
            },
            {
              badge: <OutagePlannedBadge />,
              text: "The MTA has scheduled work on this elevator. Open it to see the dates.",
            },
            {
              badge: <MaintenanceBadge when="today" />,
              text: "Maintenance starts soon: today, tonight, overnight or tomorrow. Expect the elevator to be out for part of that time.",
            },
          ]}
        />
      </Section>

      <Section title="Getting around">
        <Prose>
          {pctAccessible < 75 ? "Only " : ""}
          <span className="font-semibold tabular-nums">{pctAccessible}%</span> of subway stations are ADA
          accessible, so check that yours is in service before you go.
        </Prose>
        <Prose>
          The MTA takes elevators out for replacement for 8–12 months at a time. Upcoming outages show on
          each station’s page.
        </Prose>
        <Prose>
          Mobility devices board in the middle of the platform. Look for the conductor and the blue Boarding
          Area sign.
        </Prose>
        <figure className="flex flex-col gap-2">
          <img
            src="/boardingarea.png"
            alt="A blue Boarding Area sign hanging from a subway platform ceiling"
            className="w-full rounded-lg"
          />
          <figcaption className="text-footnote text-muted-foreground">
            The Boarding Area sign marks where to wait.
          </figcaption>
        </figure>
      </Section>

      <footer className="mx-4 mt-8 border-t border-border pt-4 text-footnote text-muted-foreground">
        <p className="max-w-[65ch] text-pretty">
          Data comes from the MTA’s real-time feed and{" "}
          <a href="https://data.ny.gov" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Open Data NY
          </a>
          , so it’s only as accurate as their reporting. Check{" "}
          <a href="https://mta.info" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            mta.info
          </a>{" "}
          for official notices.
        </p>
        <p className="mt-3">
          Version {pkg.version} · © {new Date().getFullYear()} Transit Access LLC
          <br />
          Built by Joel Chapman &amp; Prachi Kulkarni
        </p>
      </footer>
    </article>
  );
};

export default LegendPage;
