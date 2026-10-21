/**
 * Approximate locations for the map. Shared by the browser and the server.
 *
 * Privacy rules:
 *  - Positions are snapped to the centre of a grid cell about 1 km across
 *    (GRID_DEGREES) BEFORE they leave the browser, and again on the server,
 *    so an exact position is never sent or stored.
 *  - A location is shown only to accepted connections, never in ghost mode,
 *    and not once it is older than MAX_LOCATION_AGE_DAYS. 
 *  - Seeing is mutual: only people whose own area is visible see others.
 *
 * Pure functions only, so they can be unit tested.
 */

/** Grid cell size: 0.01° is about 1.1 km north-south, about 1.1 km east-west near the equator. */
export const GRID_DEGREES = 0.01;

/** A shared area stops being shown after this long without an update. */
export const MAX_LOCATION_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;

export interface Coordinates {
    lat: number;
    lng: number;
}

export const isValidCoordinates = ({ lat, lng }: Coordinates): boolean =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// Rounds away floating-point noise (0.30000000000000004 -> 0.3).
const tidy = (value: number) => Number(value.toFixed(6));

const cellCentre = (value: number, min: number, max: number): number => {
    const centre = Math.floor(value / GRID_DEGREES) * GRID_DEGREES + GRID_DEGREES / 2;
    return tidy(Math.min(Math.max(centre, min + GRID_DEGREES / 2), max - GRID_DEGREES / 2));
};

/** The centre of the grid cell containing a position. Same cell, same result. */
export const snapToGrid = ({ lat, lng }: Coordinates): Coordinates => {
    // 180°E and 180°W are the same meridian.
    const wrappedLng = lng === 180 ? -180 : lng;

    return {
        lat: cellCentre(lat, -90, 90),
        lng: cellCentre(wrappedLng, -180, 180)
    };
};

/** Great-circle distance in kilometres (haversine). */
export const distanceKm = (from: Coordinates, to: Coordinates): number => {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = toRadians(to.lat - from.lat);
    const dLng = toRadians(to.lng - from.lng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Distance as people should read it. Both positions are only known to about
 * a kilometre, so short distances are not given more precisely than that.
 */
export const describeDistance = (km: number): string => {
    if (!Number.isFinite(km)) {
        return "";
    }

    if (km < 2) {
        return "Under 2 km away";
    }

    if (km < 100) {
        return `About ${Math.round(km)} km away`;
    }

    return `About ${Math.round(km / 10) * 10} km away`;
};

export const directionsUrl = (to: Coordinates): string | null => {
    if (!isValidCoordinates(to)) {
        return null;
    }

    const { lat, lng } = snapToGrid(to);
    const params = new URLSearchParams({ api: "1", destination: `${lat},${lng}` });

    return `https://www.google.com/maps/dir/?${params.toString()}`;
};

/** Shown on connections' maps: not in ghost mode, and updated recently enough. */
export const isLocationVisible = (
    location: { ghost: boolean; positionUpdatedAt: Date | string },
    now: Date = new Date()
): boolean =>
    !location.ghost &&
    now.getTime() - new Date(location.positionUpdatedAt).getTime() <= MAX_LOCATION_AGE_DAYS * DAY_MS;


/** Mutual visibility: you see connections only while your own area is visible. */
export const canSeeOthers = (
    mine: { ghost: boolean; positionUpdatedAt: Date | string } | null,
    now: Date = new Date()
): boolean => mine !== null && isLocationVisible(mine, now);