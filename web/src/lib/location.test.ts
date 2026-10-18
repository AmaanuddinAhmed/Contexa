/**
 * Unit tests for approximate locations (positive and negative cases).
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    describeDistance,
    distanceKm,
    GRID_DEGREES,
    isLocationVisible,
    isValidCoordinates,
    MAX_LOCATION_AGE_DAYS,
    snapToGrid
} from "./location";

const PES_RING_ROAD = { lat: 12.93453, lng: 77.53459 };
const MG_ROAD = { lat: 12.97559, lng: 77.60656 };

describe("snapToGrid", () => {
    it("moves a position to its cell centre", () => {
        assert.deepEqual(snapToGrid(PES_RING_ROAD), { lat: 12.935, lng: 77.535 });
    });

    it("gives the same result anywhere in the same cell", () => {
        assert.deepEqual(snapToGrid({ lat: 12.9301, lng: 77.5301 }), snapToGrid({ lat: 12.9399, lng: 77.5399 }));
    });

    it("never moves a position by more than half a cell in each direction", () => {
        const snapped = snapToGrid(PES_RING_ROAD);
        assert.ok(Math.abs(snapped.lat - PES_RING_ROAD.lat) <= GRID_DEGREES / 2);
        assert.ok(Math.abs(snapped.lng - PES_RING_ROAD.lng) <= GRID_DEGREES / 2);
    });

    it("is stable: snapping twice changes nothing", () => {
        const once = snapToGrid(MG_ROAD);
        assert.deepEqual(snapToGrid(once), once);
    });

    it("handles negative coordinates", () => {
        assert.deepEqual(snapToGrid({ lat: -33.8688, lng: -151.2093 }), { lat: -33.865, lng: -151.205 });
    });

    it("keeps the poles and the date line inside valid ranges", () => {
        assert.ok(isValidCoordinates(snapToGrid({ lat: 90, lng: 180 })));
        assert.ok(isValidCoordinates(snapToGrid({ lat: -90, lng: -180 })));
    });
});

describe("isValidCoordinates", () => {
    it("accepts real positions", () => {
        assert.ok(isValidCoordinates(PES_RING_ROAD));
    });

    it("rejects out-of-range or non-numeric values", () => {
        assert.ok(!isValidCoordinates({ lat: 91, lng: 0 }));
        assert.ok(!isValidCoordinates({ lat: 0, lng: -181 }));
        assert.ok(!isValidCoordinates({ lat: NaN, lng: 0 }));
        assert.ok(!isValidCoordinates({ lat: 0, lng: Infinity }));
    });
});

describe("distanceKm", () => {
    it("is zero for the same place", () => {
        assert.equal(distanceKm(MG_ROAD, MG_ROAD), 0);
    });

    it("matches a known distance (PES Ring Road to MG Road, about 9 km)", () => {
        const km = distanceKm(PES_RING_ROAD, MG_ROAD);
        assert.ok(km > 8.5 && km < 9.5, String(km));
    });

    it("is symmetric", () => {
        assert.equal(distanceKm(PES_RING_ROAD, MG_ROAD), distanceKm(MG_ROAD, PES_RING_ROAD));
    });
});

describe("describeDistance", () => {
    it("does not claim more precision than the grid allows", () => {
        assert.equal(describeDistance(0), "Under 2 km away");
        assert.equal(describeDistance(1.9), "Under 2 km away");
    });

    it("rounds to whole kilometres, then to tens", () => {
        assert.equal(describeDistance(8.6), "About 9 km away");
        assert.equal(describeDistance(346), "About 350 km away");
    });

    it("is empty for an unknown distance", () => {
        assert.equal(describeDistance(NaN), "");
    });
});

describe("isLocationVisible", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    it("shows a recent location", () => {
        assert.ok(isLocationVisible({ ghost: false, positionUpdatedAt: daysAgo(1) }, now));
        assert.ok(isLocationVisible({ ghost: false, positionUpdatedAt: daysAgo(MAX_LOCATION_AGE_DAYS) }, now));
    });

    it("hides a location in ghost mode", () => {
        assert.ok(!isLocationVisible({ ghost: true, positionUpdatedAt: daysAgo(0) }, now));
    });

    it("hides a stale location", () => {
        assert.ok(!isLocationVisible({ ghost: false, positionUpdatedAt: daysAgo(MAX_LOCATION_AGE_DAYS + 1) }, now));
    });
});