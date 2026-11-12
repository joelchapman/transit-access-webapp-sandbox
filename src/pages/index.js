import Head from "next/head";
import "mapbox-gl/dist/mapbox-gl.css";
import { React, useState, useEffect } from "react";
import MtaMap from "@/components/maps/MtaMap";

export default function Home() {
  return (
    <div>
      <Head>
        <title>Transit Access | NYC Subway Elevator Outages & Live Accessibility Map</title>
        <meta
          name="description"
          content="A real-time map of elevators and accessibility in the NYC subway"
        />
        <link rel="canonical" href="https://transitaccess.org" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

        {/* Open Graph (for link previews on social/Slack/etc) */}
        <meta property="og:title" content="NYC Subway Elevator Outages & Live Accessibility Map" />
        <meta
          property="og:description"
          content="Live MTA elevator outage map for NYC subway accessibility"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://transitaccess.org" />
        <meta
          property="og:image"
          content="https://transitaccess.org/og-image.png"
        />

        {/* Structured data: helps Google understand what kind of app this is */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "NYC Subway Elevator Outage Map",
              url: "https://transitaccess.org",
              description:
                "Live MTA elevator outage map for NYC subway accessibility",
              applicationCategory: "TravelApplication",
              operatingSystem: "All",
            }),
          }}
        />
      </Head>
      <MtaMap />
    </div>
  );
}
