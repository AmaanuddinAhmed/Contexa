/**
 * Messaging rules: who may read and send messages in a conversation.
 *
 * A conversation belongs to one connection record. Only its two participants
 * may use it, and only while the connection is accepted.
 *
 * Pure functions only (no database), so the rules can be unit tested on
 * their own; the API routes load the data and apply these decisions.
 */
import type { ConnectionState, RuleResult } from "@/server/connections/rules";

/** Longest message body, in characters (after trimming). */
export const MESSAGE_MAX_LENGTH = 2000;

/** Messages returned by one page of history. */
export const MESSAGE_PAGE_SIZE = 50;

/** Upper bound on messages returned by one poll. */
export const MESSAGE_POLL_LIMIT = 100;

/** At most this many messages per sender in any rolling window. */
export const MESSAGE_RATE_LIMIT = { max: 20, windowMs: 60_000 } as const;

const deny = (status: number, code: string, message: string): RuleResult => ({
    ok: false,
    status,
    code,
    message
});

// Anyone outside the pair gets "not found", so the API never reveals
// whether a conversation between two other users exists.
const notFound = () =>
    deny(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");

/**
 * May `userId` read or send messages in the conversation of this connection?
 * Only a participant, and only once the request has been accepted.
 */
export const checkCanMessage = (
    connection: ConnectionState | null,
    userId: string
): RuleResult => {
    if (!connection) {
        return notFound();
    }

    const isParticipant =
        connection.requesterId === userId || connection.recipientId === userId;

    // Declined records are hidden from both users, as on the Connections page.
    if (!isParticipant || connection.status === "declined") {
        return notFound();
    }

    if (connection.status === "pending") {
        return deny(
            403,
            "NOT_CONNECTED",
            "You can message each other once the connection request is accepted."
        );
    }

    return { ok: true };
};

/** The other person in the conversation. Call only after checkCanMessage. */
export const otherParticipant = (connection: ConnectionState, userId: string): string =>
    connection.requesterId === userId ? connection.recipientId : connection.requesterId;

/** May a sender who sent `recentCount` messages in the current window send another? */
export const checkRateLimit = (recentCount: number): RuleResult =>
    recentCount < MESSAGE_RATE_LIMIT.max
        ? { ok: true }
        : deny(
            429,
            "TOO_MANY_MESSAGES",
            "You are sending messages too quickly. Please wait a moment."
        );