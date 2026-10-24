"use client";

import { useEffect, useRef } from "react";

export interface NotificationSummary {
    messages: number;
    requests: number;
    connectionsVersion: string;
}

export interface NotificationsResponse {
    success: boolean;
    data: NotificationSummary;
}

export const NOTIFICATIONS_POLL_MS = 15_000;

export const NOTIFICATIONS_EVENT = "contexa-notifications";

export const NOTIFICATIONS_REFRESH_EVENT = "contexa-notifications-refresh";

let latest: NotificationSummary | null = null;

export const publishNotifications = (summary: NotificationSummary): void => {
    latest = summary;
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT, { detail: summary }));
};

export const clearNotifications = (): void => {
    latest = null;
};

export const refreshNotifications = (): void => {
    window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
};

const useSummaryChange = (
    field: "messages" | "connectionsVersion",
    onChange: () => void,
): void => {
    const latestOnChange = useRef(onChange);

    useEffect(() => {
        latestOnChange.current = onChange;
    }, [onChange]);

    useEffect(() => {
        let known: unknown = latest ? latest[field] : null;

        const onSummary = (event: Event) => {
            const value = (event as CustomEvent<NotificationSummary>).detail[field];

            if (known !== null && value !== known) {
                latestOnChange.current();
            }
            known = value;
        };

        window.addEventListener(NOTIFICATIONS_EVENT, onSummary);
        return () => window.removeEventListener(NOTIFICATIONS_EVENT, onSummary);
    }, [field]);
};

export const useConnectionsChanged = (onChange: () => void): void =>
    useSummaryChange("connectionsVersion", onChange);

export const useUnreadChanged = (onChange: () => void): void =>
    useSummaryChange("messages", onChange);