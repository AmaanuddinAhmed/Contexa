/**
 * Connection rules: who may send, accept, decline or remove a connection.
 *
 * Pure functions only (no database), so the rules can be unit tested on
 * their own; the API routes load the data and apply these decisions.
 *
 * Lifecycle (one record per pair of users):
 *
 *   (none) --send--> pending --accept--> accepted --remove--> (none)
 *                       |  \--decline--> declined --send again--> pending
 *                       \--cancel (requester)--> (none)
 */

export const CONNECTION_STATUSES = ["pending", "accepted", "declined"] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type ConnectionAction = "accept" | "decline";

/** The fields the rules need, with ids as strings. */
export interface ConnectionState {
    requesterId: string;
    recipientId: string;
    status: ConnectionStatus;
}

export type RuleResult =
    | { ok: true }
    | { ok: false; status: number; code: string; message: string };

const allow = (): RuleResult => ({ ok: true });

const deny = (status: number, code: string, message: string): RuleResult => ({
    ok: false,
    status,
    code,
    message
});

/** Same key whichever user sent the request, so a pair has one record. */
export const toPairKey = (firstUserId: string, secondUserId: string): string =>
    [firstUserId, secondUserId].sort().join(":");

const isParticipant = (connection: ConnectionState, userId: string): boolean =>
    connection.requesterId === userId || connection.recipientId === userId;

// Non-participants get "not found" rather than "forbidden", so the API never
// reveals whether two other users are connected.
const notFound = () =>
    deny(404, "CONNECTION_NOT_FOUND", "Connection request not found.");

/**
 * May `requesterId` send a request to `recipientId`, given the pair's
 * existing record (if any)? A declined record may be reused for a new request.
 */
export const checkNewRequest = (
    requesterId: string,
    recipientId: string,
    existing: ConnectionState | null
): RuleResult => {
    if (requesterId === recipientId) {
        return deny(400, "CANNOT_CONNECT_TO_SELF", "You cannot connect with yourself.");
    }

    if (!existing || existing.status === "declined") {
        return allow();
    }

    if (existing.status === "accepted") {
        return deny(409, "ALREADY_CONNECTED", "You are already connected.");
    }

    // Pending: who sent it decides the message.
    if (existing.requesterId === requesterId) {
        return deny(409, "REQUEST_ALREADY_SENT", "You have already sent a request.");
    }

    return deny(
        409,
        "INCOMING_REQUEST_EXISTS",
        "This person has already sent you a request. Accept it from Connections."
    );
};

/** May `userId` accept or decline this request? Only the recipient, only while pending. */
export const checkRespond = (
    connection: ConnectionState,
    userId: string
): RuleResult => {
    if (!isParticipant(connection, userId)) {
        return notFound();
    }

    if (connection.recipientId !== userId) {
        return deny(403, "NOT_RECIPIENT", "Only the recipient can respond to a request.");
    }

    if (connection.status !== "pending") {
        return deny(409, "NOT_PENDING", "This request has already been answered.");
    }

    return allow();
};

/**
 * May `userId` delete this record? The requester may cancel a pending request;
 * either person may remove an accepted connection.
 */
export const checkRemove = (
    connection: ConnectionState,
    userId: string
): RuleResult => {
    if (!isParticipant(connection, userId)) {
        return notFound();
    }

    if (connection.status === "accepted") {
        return allow();
    }

    if (connection.status === "pending") {
        return connection.requesterId === userId
            ? allow()
            : deny(403, "NOT_REQUESTER", "Decline the request instead of removing it.");
    }

    // Declined records are hidden from both users, so there is nothing to remove.
    return notFound();
};