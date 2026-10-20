// Shapes returned by /api/v1/messages, and helpers shared by the pages that use them.

export interface ChatMessage {
    id: string;
    connectionId: string;
    senderId: string;
    body: string;
    createdAt: string;
    /** True when the current user sent it. */
    mine: boolean;
}

export interface MessagesResponse {
    success: boolean;
    data: {
        messages: ChatMessage[];
        /** Older history exists before the first message returned. */
        hasMore: boolean;
        /** The other person has read the caller's messages up to this time. */
        seenUpTo: string | null;
    };
}

export interface SendMessageResponse {
    success: boolean;
    data: { message: ChatMessage };
}

export interface UnreadResponse {
    success: boolean;
    data: {
        total: number;
        /** Connection id -> unread count; conversations with none are absent. */
        byConnection: Record<string, number>;
    };
}

/** Same limit as server/messages/rules.ts, checked again by the API. */
export const MESSAGE_MAX_LENGTH = 2000;

/**
 * How long an open conversation waits before checking for new messages,
 * given how long it has been quiet (no message sent, received or typed).
 * Fast while people are chatting, slower as the conversation goes idle, so a
 * live chat feels near-instant without polling every second all day.
 */
export const THREAD_POLL_STEPS: readonly { quietForMs: number; delayMs: number }[] = [
    { quietForMs: 30_000, delayMs: 1000 }, // active chat
    { quietForMs: 120_000, delayMs: 2000 }, // reply probably being written
    { quietForMs: 300_000, delayMs: 5000 }, // winding down
];

/** Delay once the conversation has been quiet longer than every step above. */
export const THREAD_POLL_IDLE_MS = 10_000;

export const threadPollDelay = (quietForMs: number): number =>
    THREAD_POLL_STEPS.find((step) => quietForMs < step.quietForMs)?.delayMs ??
    THREAD_POLL_IDLE_MS;

/** Fired on window when a conversation was read, so unread badges refresh at once. */
export const MESSAGES_READ_EVENT = "contexa-messages-read";

/** Has the other person read this (own) message? */
export const isSeen = (message: ChatMessage, seenUpTo: string | null): boolean =>
    message.mine && seenUpTo !== null && message.createdAt <= seenUpTo;

/**
 * Adds `incoming` to `current`, oldest first, keeping one copy of each
 * message. Polls overlap by design, so duplicates are expected.
 */
export const mergeMessages = (
    current: ChatMessage[],
    incoming: ChatMessage[],
): ChatMessage[] => {
    const byId = new Map(current.map((message) => [message.id, message]));

    incoming.forEach((message) => byId.set(message.id, message));

    return [...byId.values()].sort(
        (first, second) =>
            first.createdAt.localeCompare(second.createdAt) ||
            first.id.localeCompare(second.id),
    );
};