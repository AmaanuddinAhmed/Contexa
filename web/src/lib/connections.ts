export interface ConnectionUser {
    userId: string;
    name: string;
    role?: string;
    education?: string;
    experienceLevel?: string;
    skills: string[];
    interests: string[];
    isSample?: boolean;
    avatarUrl?: string | null;
}

export interface ConnectionItem {
    id: string;
    status: "pending" | "accepted";
    direction: "incoming" | "outgoing";
    message?: string;
    createdAt: string;
    respondedAt?: string;
    user: ConnectionUser;
}

export interface ConnectionsResponse {
    success: boolean;
    data: {
        incoming: ConnectionItem[];
        outgoing: ConnectionItem[];
        connections: ConnectionItem[];
    };
}

export type ConnectionState = "none" | "outgoing" | "incoming" | "connected";

export const toStateByUserId = (
    data: ConnectionsResponse["data"],
): Map<string, ConnectionState> => {
    const states = new Map<string, ConnectionState>();

    data.outgoing.forEach((item) => states.set(item.user.userId, "outgoing"));
    data.incoming.forEach((item) => states.set(item.user.userId, "incoming"));
    data.connections.forEach((item) => states.set(item.user.userId, "connected"));

    return states;
};