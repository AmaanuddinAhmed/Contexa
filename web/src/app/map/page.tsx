"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Coordinates,
  describeDistance,
  MAX_LOCATION_AGE_DAYS,
  snapToGrid,
} from "@/lib/location";
import type { MapPerson } from "@/components/MapView";

// Leaflet needs the browser (window), so the map is never server-rendered.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

interface MyLocation extends Coordinates {
  ghost: boolean;
  positionUpdatedAt: string;
}

interface MapData {
  me: MyLocation | null;
  people: MapPerson[];
  connections: number;
}

type LoadResult = { data: MapData } | { error: string };

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// Never throws: returns the map data or an error message.
const fetchMap = async (): Promise<LoadResult> => {
  try {
    const response = await api<{ data: MapData }>("/map", {
      token: getToken() ?? undefined,
    });
    return { data: response.data };
  } catch (error) {
    return { error: errorText(error, "Unable to load the map.") };
  }
};

const GEOLOCATION_ERRORS: Record<number, string> = {
  1: "Location permission was denied. Choose your area on the map instead.",
  2: "Your location could not be found. Choose your area on the map instead.",
  3: "Finding your location took too long. Try again, or choose your area on the map.",
};

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const applyResult = useCallback((result: LoadResult) => {
    if ("data" in result) {
      setData(result.data);
      setError("");
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchMap().then((result) => {
      if (!cancelled) {
        applyResult(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  /** Runs a change, then reloads so distances and lists are recomputed. */
  const run = async (change: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError("");

    try {
      await change();
      applyResult(await fetchMap());
    } catch (changeError) {
      setError(errorText(changeError, fallback));
    } finally {
      setBusy(false);
    }
  };

  const share = (position: Coordinates) => {
    setPicking(false);

    // Snapped here, so the exact position never leaves the browser.
    return run(
      () =>
        api("/map/location", {
          method: "PUT",
          token: getToken() ?? undefined,
          body: JSON.stringify(snapToGrid(position)),
        }),
      "Unable to save your location.",
    );
  };

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setError(GEOLOCATION_ERRORS[2]);
      return;
    }

    setBusy(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void share({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (geolocationError) => {
        setBusy(false);
        setError(
          GEOLOCATION_ERRORS[geolocationError.code] ?? GEOLOCATION_ERRORS[2],
        );
      },
      // Approximate is all that is needed, and it is faster and kinder to batteries.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const setGhost = (ghost: boolean) =>
    run(
      () =>
        api("/map/location", {
          method: "PATCH",
          token: getToken() ?? undefined,
          body: JSON.stringify({ ghost }),
        }),
      "Unable to update ghost mode.",
    );

  const removeLocation = () => {
    if (
      window.confirm(
        "Stop sharing your area? Your connections will no longer see you on the map.",
      )
    ) {
      void run(
        () =>
          api("/map/location", {
            method: "DELETE",
            token: getToken() ?? undefined,
          }),
        "Unable to remove your location.",
      );
    }
  };

  const me = data?.me ?? null;
  const people = data?.people ?? [];
  const buttonClass =
    "rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50";

  return (
    <main className="flex-1 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-950">Map</h1>
        <p className="mt-3 max-w-3xl text-zinc-600">
          See roughly where your connections are, to plan meeting in person.
          Only your approximate area (about 1 km) is stored, only people you are
          connected with can see it, and areas not updated for{" "}
          {MAX_LOCATION_AGE_DAYS} days disappear.
        </p>

        <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm">
            {loading ? (
              <p className="text-zinc-500">Loading…</p>
            ) : me ? (
              <>
                <p className="font-semibold text-zinc-900">
                  {me.ghost
                    ? "Ghost mode is on: nobody can see you"
                    : "Your connections can see your area"}
                </p>
                <p className="text-zinc-500">
                  Area set {new Date(me.positionUpdatedAt).toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-zinc-900">
                  You are not sharing your area
                </p>
                <p className="text-zinc-500">
                  You can still see connections who share theirs.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={busy || loading}
              className={`${buttonClass} bg-black text-white hover:bg-zinc-800`}
            >
              {me ? "Update to my current area" : "Share my current area"}
            </button>

            <button
              type="button"
              onClick={() => setPicking((value) => !value)}
              disabled={busy || loading}
              aria-pressed={picking}
              className={`${buttonClass} border ${
                picking
                  ? "border-black bg-zinc-100 text-black"
                  : "border-zinc-200 text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {picking ? "Click the map… (cancel)" : "Choose on map"}
            </button>

            {me && (
              <>
                <button
                  type="button"
                  role="switch"
                  aria-checked={me.ghost}
                  onClick={() => setGhost(!me.ghost)}
                  disabled={busy}
                  className={`${buttonClass} inline-flex items-center gap-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-50`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative h-5 w-9 rounded-full transition ${me.ghost ? "bg-black" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        me.ghost ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </span>
                  Ghost mode
                </button>

                <button
                  type="button"
                  onClick={removeLocation}
                  disabled={busy}
                  className={`${buttonClass} border border-zinc-200 text-zinc-600 hover:bg-zinc-50`}
                >
                  Stop sharing
                </button>
              </>
            )}
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-6 h-[60vh] min-h-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {!loading && (
            <MapView
              me={me}
              people={people}
              picking={picking}
              onPick={(position) => void share(position)}
            />
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Dashed circle: your area. Filled circles: connections. Circles show an
          area, not an exact position. Ghost mode hides you from everyone; you
          can still see them.
        </p>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Connections on the map{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({people.length} of {data?.connections ?? 0})
            </span>
          </h2>

          {people.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
              {data?.connections
                ? "None of your connections are sharing their area right now."
                : "No connections yet. Connect with people from your "}
              {!data?.connections && (
                <Link href="/recommendations" className="font-medium underline">
                  recommendations
                </Link>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
              {people.map((person) => (
                <li
                  key={person.userId}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">
                      {person.name}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      {[
                        person.role,
                        person.distanceKm !== null
                          ? describeDistance(person.distanceKm)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Connected"}
                    </p>
                  </div>
                  <Link
                    href={`/messages?c=${person.connectionId}`}
                    className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Message
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
