"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  canSeeOthers,
  Coordinates,
  describeDistance,
  isLocationVisible,
  MAX_LOCATION_AGE_DAYS,
  snapToGrid,
} from "@/lib/location";
import type { MapPerson } from "@/components/MapView";
import Avatar from "@/components/Avatar";

// Leaflet needs the browser (window), so the map is never server-rendered.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" />,
});

interface MyLocation extends Coordinates {
  ghost: boolean;
  positionUpdatedAt: string;
}

interface MapData {
  me: MyLocation | null;
  people: MapPerson[];
  canSee: boolean;
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
  // "Stop sharing" asks once more inline before deleting the area.
  const [confirmingStop, setConfirmingStop] = useState(false);

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
    setConfirmingStop(false);
    void run(
      () =>
        api("/map/location", {
          method: "DELETE",
          token: getToken() ?? undefined,
        }),
      "Unable to remove your location.",
    );
  };

  const me = data?.me ?? null;
  const people = data?.people ?? [];
  const expired = me !== null && !me.ghost && !isLocationVisible(me);
  const canSee = data?.canSee ?? canSeeOthers(me);

  const status = loading ? (
    <div className="space-y-2" aria-busy="true">
      <div className="skeleton h-5 w-3/4" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  ) : me ? (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          me.ghost || expired
            ? "bg-faint"
            : "bg-ok [animation:pulse-dot_2s_ease-in-out_infinite]"
        }`}
      />
      <div>
        <p className="font-semibold">
          {me.ghost
            ? "Ghost mode is on: nobody sees you, and you don’t see others"
            : expired
              ? "Your area has expired: update it to appear again"
              : "Your connections can see your area"}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Area set {new Date(me.positionUpdatedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-line-strong"
      />
      <div>
        <p className="font-semibold">You’re not sharing your area</p>
        <p className="mt-0.5 text-sm text-muted">
          Share your area to see connections who share theirs.
        </p>
      </div>
    </div>
  );

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Map</h1>
        <p className="page-lede">
          Roughly where your connections are, to plan meeting in person. Only
          your approximate area (about 1 km) is stored, only people you’re
          connected with can see it, and areas not updated for{" "}
          {MAX_LOCATION_AGE_DAYS} days disappear.
        </p>
      </header>

      {error && (
        <p role="alert" className="alert-error mt-6">
          {error}
        </p>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="lg:sticky lg:top-24">
          <div
            className={`relative h-[55vh] min-h-[340px] overflow-hidden rounded-[1.75rem] bg-surface shadow-[var(--shadow-lift)] ring-1 transition-shadow duration-300 lg:h-[68vh] ${
              picking ? "ring-2 ring-brand" : "ring-line/70"
            }`}
          >
            {!loading && (
              <MapView
                me={me}
                people={people}
                picking={picking}
                onPick={(position) => void share(position)}
              />
            )}
            {picking && (
              <p className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2 animate-fade rounded-full bg-ink px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-[var(--shadow-float)]">
                Tap the map to set your area
              </p>
            )}
          </div>
          <p className="mt-2.5 text-xs leading-5 text-faint">
            Dashed circle: your area. Blue circles: connections. Circles show an
            area, not an exact position.
          </p>
        </div>

        <div className="grid gap-6">
          <section className="panel p-5 sm:p-6" aria-label="Your sharing">
            {status}

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={busy || loading}
                className="btn btn-primary"
              >
                {me ? "Update to my current area" : "Share my current area"}
              </button>
              <button
                type="button"
                onClick={() => setPicking((value) => !value)}
                disabled={busy || loading}
                aria-pressed={picking}
                className={`btn ${picking ? "btn-ink" : "btn-quiet"}`}
              >
                {picking ? "Cancel choosing" : "Choose on the map"}
              </button>
            </div>

            {me && (
              <div className="mt-5 border-t border-line pt-5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={me.ghost}
                  onClick={() => setGhost(!me.ghost)}
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl text-left disabled:opacity-50"
                >
                  <span>
                    <span className="block font-semibold">Ghost mode</span>
                    <span className="block text-sm text-muted">
                      Hide from everyone; you won’t see them either.
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${
                      me.ghost ? "bg-ink" : "bg-line-strong"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-500 ease-[var(--ease-spring)] ${
                        me.ghost ? "translate-x-5" : ""
                      }`}
                    />
                  </span>
                </button>

                {confirmingStop ? (
                  <div className="mt-4 animate-fade rounded-2xl bg-danger-soft p-3">
                    <p className="text-sm text-danger">
                      Stop sharing? Your area is deleted and connections no
                      longer see you on the map.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={removeLocation}
                        disabled={busy}
                        className="btn bg-danger text-white hover:bg-danger/90"
                      >
                        Stop sharing
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingStop(false)}
                        className="btn btn-quiet"
                      >
                        Keep sharing
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingStop(true)}
                    disabled={busy}
                    className="mt-4 text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline disabled:opacity-50"
                  >
                    Stop sharing my area
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2.5 text-xl font-semibold">
              On the map
              <span className="rounded-full bg-sunk px-2 font-sans text-xs leading-6 font-bold text-muted tabular-nums">
                {people.length} of {data?.connections ?? 0}
              </span>
            </h2>

            {people.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-line-strong px-5 py-6 text-sm leading-6 text-muted">
                {!canSee && data?.connections ? (
                  me?.ghost ? (
                    "Turn off ghost mode to see your connections."
                  ) : expired ? (
                    "Update your area to see your connections."
                  ) : (
                    "Share your area to see your connections."
                  )
                ) : data?.connections ? (
                  "None of your connections are sharing their area right now."
                ) : (
                  <>
                    No connections yet. Connect with people from{" "}
                    <Link
                      href="/recommendations"
                      className="font-semibold text-brand"
                    >
                      your matches
                    </Link>
                    .
                  </>
                )}
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-[1.5rem] bg-surface ring-1 ring-line/70">
                {people.map((person) => (
                  <li
                    key={person.userId}
                    className="flex items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        src={person.avatarUrl}
                        name={person.name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{person.name}</p>
                        <p className="truncate text-sm text-muted">
                          {person.role || "Connected"}
                        </p>
                        {person.distanceKm !== null && (
                          <p className="text-xs font-medium text-brand">
                            {describeDistance(person.distanceKm)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/messages?c=${person.connectionId}`}
                      className="btn btn-quiet shrink-0 px-4 py-2"
                    >
                      Message
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
