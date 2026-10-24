import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    ChatMessage,
    mergeMessages,
    THREAD_POLL_IDLE_MS,
    threadPollDelay,
    isSeen
} from "./messages";

const message = (id: string, createdAt: string): ChatMessage => ({
    id,
    connectionId: "c1",
    senderId: "u1",
    body: `message ${id}`,
    createdAt,
    mine: false,
});

const T1 = "2026-10-16T10:00:00.000Z";
const T2 = "2026-10-16T10:00:05.000Z";
const T3 = "2026-10-16T10:00:09.000Z";

const ids = (messages: ChatMessage[]) => messages.map((item) => item.id);

describe("mergeMessages", () => {
    it("appends new messages in time order", () => {
        const merged = mergeMessages([message("a", T1)], [message("b", T2)]);
        assert.deepEqual(ids(merged), ["a", "b"]);
    });

    it("keeps one copy of a message returned by overlapping polls", () => {
        const merged = mergeMessages(
            [message("a", T1), message("b", T2)],
            [message("b", T2), message("c", T3)],
        );
        assert.deepEqual(ids(merged), ["a", "b", "c"]);
    });

    it("puts older history before the current messages", () => {
        const merged = mergeMessages([message("c", T3)], [message("a", T1), message("b", T2)]);
        assert.deepEqual(ids(merged), ["a", "b", "c"]);
    });

    it("orders messages sent in the same millisecond by id", () => {
        const merged = mergeMessages([message("y", T1)], [message("x", T1)]);
        assert.deepEqual(ids(merged), ["x", "y"]);
    });

    it("returns the current list unchanged when nothing new arrives", () => {
        const current = [message("a", T1)];
        assert.deepEqual(mergeMessages(current, []), current);
    });
});

describe("threadPollDelay", () => {
    it("polls every second while the chat is active", () => {
        assert.equal(threadPollDelay(0), 1000);
        assert.equal(threadPollDelay(29_999), 1000);
    });

    it("slows down step by step as the chat goes quiet", () => {
        assert.equal(threadPollDelay(30_000), 2000);
        assert.equal(threadPollDelay(119_999), 2000);
        assert.equal(threadPollDelay(120_000), 5000);
        assert.equal(threadPollDelay(299_999), 5000);
    });

    it("settles at the idle delay", () => {
        assert.equal(threadPollDelay(300_000), THREAD_POLL_IDLE_MS);
        assert.equal(threadPollDelay(24 * 60 * 60 * 1000), THREAD_POLL_IDLE_MS);
    });

    it("never polls slower for more recent activity", () => {
        const samples = [0, 10_000, 30_000, 60_000, 120_000, 200_000, 300_000, 900_000];
        const delays = samples.map(threadPollDelay);
        delays.slice(1).forEach((delay, index) => assert.ok(delay >= delays[index]));
    });
});


describe("isSeen", () => {
    const mine = { ...message("m1", "2026-10-20T10:00:00.000Z"), mine: true };

    it("is seen once the other person has read up to it or later", () => {
        assert.ok(isSeen(mine, "2026-10-20T10:00:00.000Z"));
        assert.ok(isSeen(mine, "2026-10-20T10:05:00.000Z"));
    });

    it("is not seen before that", () => {
        assert.ok(!isSeen(mine, "2026-10-20T09:59:59.999Z"));
        assert.ok(!isSeen(mine, null));
    });

    it("never marks the other person's messages", () => {
        assert.ok(!isSeen({ ...mine, mine: false }, "2026-10-20T11:00:00.000Z"));
    });
});