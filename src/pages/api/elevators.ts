import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";

function toElevatorFeature(row: any) {
  return {
    type: "Feature",
    properties: {
      elevatorno: row.elevator_id,
      complexID: row.complex_id,
      stationID: row.station_id,
      route: row.route,
      linesServed: row.lines_served,
      elevatorgtfsstopid: row.gtfs_stop_id,
      title: row.title,
      directionLabel: row.direction_label,
      shortdescription: row.short_description,
      description_custom: row.description_custom,
      alternativeRoute: row.alternative_route,
      ada: row.ada,
      isStreet: row.is_street,
      isRedundant: row.is_redundant,
      isBridge: row.is_bridge,
      isOverpass: row.is_overpass,
      isMezzTransferOnly: row.is_mezz_transfer_only,
      redundantIndex: row.redundant_index,
      image: row.image,
      access_note: row.access_note,
      isLastAccessibleStop: row.is_last_accessible_stop,
      isLastStop: row.is_last_stop,
    },
    geometry: row.geometry,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const { complexId } = req.query;

  let query = supabase.from("elevators").select("*");
  if (complexId && typeof complexId === "string") {
    query = query.eq("complex_id", complexId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching elevators:", error);
    return res.status(500).json({ error: "Failed to fetch elevators" });
  }

  return res.status(200).json({
    type: "FeatureCollection",
    features: data.map(toElevatorFeature),
  });
}
