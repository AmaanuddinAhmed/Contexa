import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeServiceStatus, shouldWarm, WARM_INTERVAL_MS } from "./warm";

const NOW = 1_800_000_000_000;

describe("shouldWarm", () => {
    it("pings when this browser never has", () => {
        assert.equal(shouldWarm(null, NOW), true);
    });

    it("pings again once the interval has passed", () => {
        assert.equal(shouldWarm(NOW - WARM_INTERVAL_MS, NOW), true);
    });

    it("does not ping again within the interval", () => {
        assert.equal(shouldWarm(NOW - WARM_INTERVAL_MS + 1, NOW), false);
        assert.equal(shouldWarm(NOW, NOW), false);
    });

    it("pings when the stored time is unusable or in the future", () => {
        assert.equal(shouldWarm(Number.NaN, NOW), true);
        assert.equal(shouldWarm(NOW + 60_000, NOW), true);
    });
});

describe("describeServiceStatus", () => {
    it("describes a quick answer", () => {
        assert.equal(describeServiceStatus({ awake: true, ms: 312 }), "Awake; answered in 312 ms");
    });

    it("describes a cold start", () => {
        assert.equal(describeServiceStatus({ awake: true, ms: 41_400 }), "Was asleep; woke up in 41 s");
    });

    it("describes no answer", () => {
        assert.equal(describeServiceStatus({ awake: false, ms: 60_000 }), "No answer after 60 s");
    });
});