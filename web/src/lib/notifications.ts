"use client";

import { useEffect, useRef } from "react";

/*
 * The header polls /api/v1/notifications and broadcasts the result, so pages
 * react to new requests, accepts and messages without polling on their own.
 */

export interface NotificationSummary {
    /** Unread messages. */
    messages: number;
    /** Connection requests waiting on the current user. */
    requests: number;
    /** Changes whenever any of the user's connections changes. */
    connectionsVersion: string;
}

export interface NotificationsResponse {
    success: boolean;
    data: NotificationSummary;
}

/** How often the header checks for news while the tab is visible. */
export const NOTIFICATIONS_POLL_MS = 15_000;

/** Fired by the header with the latest summary (event.detail). */
export const NOTIFICATIONS_EVENT = "contexa-notifications";

/** Fired by pages to ask the header to check right away (e.g. after accepting). */
export const NOTIFICATIONS_REFRESH_EVENT = "contexa-notifications-refresh";

// The latest summary, so a page that mounts later starts from it.
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

/**
 * Calls `onChange` when one field of the summary changes after this page
 * loaded. The first summary a page sees is its starting point, not a change.
 */
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

/** A request arrived, was accepted or declined, or a connection was removed. */
export const useConnectionsChanged = (onChange: () => void): void =>
    useSummaryChange("connectionsVersion", onChange);

/** The unread message total changed. */
export const useUnreadChanged = (onChange: () => void): void =>
    useSummaryChange("messages", onChange);