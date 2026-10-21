"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import Link from "next/link";
import { LatLngBounds } from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Coordinates, describeDistance } from "@/lib/location";

export interface MapPerson {
  userId: string;
  connectionId: string;
  name: string;
  role?: string;
  lat: number;
  lng: number;
  distanceKm: number | null; 
  avatarUrl?: string | null;
}

interface MapViewProps {
  me: (Coordinates & { ghost: boolean }) | null;
  people: MapPerson[];
  /** When true, a click on the map sets the user's area. */
  picking: boolean;
  onPick: (position: Coordinates) => void;
}

// Areas are drawn as circles about the size of a grid cell, so nobody
// reads a precise position into them.
const AREA_RADIUS_M = 800;
const INDIA: [number, number] = [21, 78];

/** Fits the view to everyone shown, once per change in who is shown. */
function FitToPeople({ me, people }: Pick<MapViewProps, "me" | "people">) {
  const map = useMap();
  const key = [
    me ? `${me.lat},${me.lng}` : "",
    ...people.map((person) => person.userId),
  ].join("|");

  useEffect(() => {
    const points: [number, number][] = [
      ...(me ? [[me.lat, me.lng] as [number, number]] : []),
      ...people.map((person) => [person.lat, person.lng] as [number, number]),
    ];

    if (points.length === 1) {
      map.setView(points[0], 12);
    } else if (points.length > 1) {
      map.fitBounds(new LatLngBounds(points), {
        padding: [40, 40],
        maxZoom: 13,
      });
    }
    // `key` captures every position that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

function PickOnClick({
  picking,
  onPick,
}: Pick<MapViewProps, "picking" | "onPick">) {
  const map = useMapEvents({
    click: (event) => {
      if (picking) {
        onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
      }
    },
  });

  useEffect(() => {
    map.getContainer().style.cursor = picking ? "crosshair" : "";
  }, [map, picking]);

  return null;
}

export default function MapView({ me, people, picking, onPick }: MapViewProps) {
  return (
    <MapContainer
      center={me ? [me.lat, me.lng] : INDIA}
      zoom={me ? 12 : 4}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={15}
      />

      <FitToPeople me={me} people={people} />
      <PickOnClick picking={picking} onPick={onPick} />

      {people.map((person) => (
        <Circle
          key={person.userId}
          center={[person.lat, person.lng]}
          radius={AREA_RADIUS_M}
          pathOptions={{
            color: "#3352ff",
            weight: 2,
            fillColor: "#3352ff",
            fillOpacity: 0.22,
          }}
        >
          <Tooltip direction="top">{person.name}</Tooltip>
          <Popup>
            <p className="m-0 font-display text-base font-semibold">
              {person.name}
            </p>
            {person.role && <p className="m-0 text-muted">{person.role}</p>}
            {person.distanceKm !== null && (
              <p className="m-0 mt-1">{describeDistance(person.distanceKm)}</p>
            )}
            <Link
              href={`/messages?c=${person.connectionId}`}
              className="mt-2 inline-block font-semibold !text-brand"
            >
              Message
            </Link>
          </Popup>
        </Circle>
      ))}

      {me && (
        <>
          <Circle
            center={[me.lat, me.lng]}
            radius={AREA_RADIUS_M}
            pathOptions={{
              color: me.ghost ? "#8d91a8" : "#121530",
              weight: 2,
              dashArray: "6 6",
              fillOpacity: 0.05,
            }}
          />
          <CircleMarker
            center={[me.lat, me.lng]}
            radius={5}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: me.ghost ? "#8d91a8" : "#121530",
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" permanent>
              {me.ghost ? "You (hidden)" : "You"}
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  );
}
