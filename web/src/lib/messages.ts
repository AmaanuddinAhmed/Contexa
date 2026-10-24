export interface ChatMessage {
    id: string;
    connectionId: string;
    senderId: string;
    body: string;
    createdAt: string;
    mine: boolean;
}

export interface MessagesResponse {
    success: boolean;
    data: {
        messages: ChatMessage[];
        hasMore: boolean;
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
        byConnection: Record<string, number>;
    };
}

export const MESSAGE_MAX_LENGTH = 2000;

export const THREAD_POLL_STEPS: readonly { quietForMs: number; delayMs: number }[] = [
    { quietForMs: 30_000, delayMs: 1000 },
    { quietForMs: 120_000, delayMs: 2000 },
    { quietForMs: 300_000, delayMs: 5000 },
];

export const THREAD_POLL_IDLE_MS = 10_000;

export const threadPollDelay = (quietForMs: number): number =>
    THREAD_POLL_STEPS.find((step) => quietForMs < step.quietForMs)?.delayMs ??
    THREAD_POLL_IDLE_MS;

export const MESSAGES_READ_EVENT = "contexa-messages-read";

export const isSeen = (message: ChatMessage, seenUpTo: string | null): boolean =>
    message.mine && seenUpTo !== null && message.createdAt <= seenUpTo;

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