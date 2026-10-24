export const CONNECTION_STATUSES = ["pending", "accepted", "declined"] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type ConnectionAction = "accept" | "decline";

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

export const toPairKey = (firstUserId: string, secondUserId: string): string =>
    [firstUserId, secondUserId].sort().join(":");

const isParticipant = (connection: ConnectionState, userId: string): boolean =>
    connection.requesterId === userId || connection.recipientId === userId;

const notFound = () =>
    deny(404, "CONNECTION_NOT_FOUND", "Connection request not found.");

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

    if (existing.requesterId === requesterId) {
        return deny(409, "REQUEST_ALREADY_SENT", "You have already sent a request.");
    }

    return deny(
        409,
        "INCOMING_REQUEST_EXISTS",
        "This person has already sent you a request. Accept it from Connections."
    );
};

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

    return notFound();
};