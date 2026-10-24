import type { ConnectionState, RuleResult } from "@/server/connections/rules";

export const MESSAGE_MAX_LENGTH = 2000;

export const MESSAGE_PAGE_SIZE = 50;

export const MESSAGE_POLL_LIMIT = 100;

export const MESSAGE_RATE_LIMIT = { max: 20, windowMs: 60_000 } as const;

const deny = (status: number, code: string, message: string): RuleResult => ({
    ok: false,
    status,
    code,
    message
});

const notFound = () =>
    deny(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");

export const checkCanMessage = (
    connection: ConnectionState | null,
    userId: string
): RuleResult => {
    if (!connection) {
        return notFound();
    }

    const isParticipant =
        connection.requesterId === userId || connection.recipientId === userId;

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

export const otherParticipant = (connection: ConnectionState, userId: string): string =>
    connection.requesterId === userId ? connection.recipientId : connection.requesterId;

export const checkRateLimit = (recentCount: number): RuleResult =>
    recentCount < MESSAGE_RATE_LIMIT.max
        ? { ok: true }
        : deny(
            429,
            "TOO_MANY_MESSAGES",
            "You are sending messages too quickly. Please wait a moment."
        );