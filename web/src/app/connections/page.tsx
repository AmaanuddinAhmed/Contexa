"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ConnectionItem, ConnectionsResponse } from "@/lib/connections";
import Avatar from "@/components/Avatar";
import SampleTag from "@/components/SampleTag";
import {
  refreshNotifications,
  useConnectionsChanged,
} from "@/lib/notifications";

type Lists = ConnectionsResponse["data"];

const EMPTY: Lists = { incoming: [], outgoing: [], connections: [] };

interface LoadResult {
  lists?: Lists;
  error?: string;
}

// Never throws: returns the lists or an error message.
const fetchLists = async (): Promise<LoadResult> => {
  try {
    const response = await api<ConnectionsResponse>("/connections", {
      token: getToken() ?? undefined,
    });
    return { lists: response.data };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to load connections.",
    };
  }
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

function PersonSummary({
  item,
  compact,
}: {
  item: ConnectionItem;
  compact?: boolean;
}) {
  const { user } = item;
  const details = [user.role, user.education].filter(Boolean).join(", ");

  return (
    <div className="flex min-w-0 items-start gap-3.5">
      <Avatar
        src={user.avatarUrl}
        name={user.name}
        size={compact ? "sm" : "md"}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg leading-tight font-semibold">
          {user.name}
        </p>
        {user.isSample && <SampleTag className="mt-1" />}
        <p className="mt-0.5 text-sm text-muted">
          {details || "No details yet"}
          {user.experienceLevel && (
            <span className="text-faint"> ({user.experienceLevel})</span>
          )}
        </p>

        {!compact && user.skills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {user.skills.slice(0, 5).map((skill) => (
              <span key={skill} className="chip">
                {skill}
              </span>
            ))}
          </div>
        )}

        {item.message && (
          <p className="mt-3 rounded-2xl rounded-tl-md bg-sunk px-3.5 py-2.5 text-sm leading-6 text-ink-soft">
            {item.message}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  highlight,
}: {
  title: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-xl font-semibold">
      {title}
      <span
        className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 font-sans text-xs leading-6 font-bold tabular-nums ${
          highlight && count > 0 ? "bg-signal text-ink" : "bg-sunk text-muted"
        }`}
      >
        {count}
      </span>
    </h2>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[1.5rem] border border-dashed border-line-strong px-5 py-6 text-sm leading-6 text-muted">
      {children}
    </p>
  );
}

export default function ConnectionsPage() {
  const [lists, setLists] = useState<Lists>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  // Id of the record an action is running on, to disable its buttons.
  const [busyId, setBusyId] = useState<string | null>(null);
  // Connection waiting for a second click on "Remove".
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // `actionError` (from a failed accept/decline/remove) takes priority over
  // the result of the reload that follows it.
  const applyResult = (result: LoadResult, actionError = "") => {
    if (result.lists) {
      setLists(result.lists);
    }
    setMessage(actionError || result.error || "");
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    fetchLists().then((result) => {
      if (!cancelled) {
        applyResult(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Someone sent, accepted or declined a request: show it without a refresh.
  useConnectionsChanged(() => {
    void fetchLists().then((result) => applyResult(result));
  });

  const runAction = async (
    item: ConnectionItem,
    request: { method: "PATCH" | "DELETE"; body?: object },
  ) => {
    setBusyId(item.id);
    setConfirmingId(null);
    let actionError = "";

    try {
      await api(`/connections/${item.id}`, {
        method: request.method,
        token: getToken() ?? undefined,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
    } catch (error) {
      actionError =
        error instanceof Error ? error.message : "Something went wrong.";
    }

    // Reload either way, so the page shows the real current state.
    applyResult(await fetchLists(), actionError);
    setBusyId(null);
    refreshNotifications();
  };

  const received = (
    <section className="order-1">
      <SectionHeading
        title="Requests for you"
        count={lists.incoming.length}
        highlight
      />
      {lists.incoming.length === 0 ? (
        <EmptyNote>No one is waiting on you.</EmptyNote>
      ) : (
        <ul className="space-y-3">
          {lists.incoming.map((item, index) => (
            <li
              key={item.id}
              style={{ animationDelay: `${index * 60}ms` }}
              className="panel animate-rise p-5 ring-2 ring-signal/60 sm:p-5"
            >
              <PersonSummary item={item} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() =>
                    runAction(item, {
                      method: "PATCH",
                      body: { action: "accept" },
                    })
                  }
                  className="btn btn-primary"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() =>
                    runAction(item, {
                      method: "PATCH",
                      body: { action: "decline" },
                    })
                  }
                  className="btn btn-quiet"
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const sent = (
    <section className="order-3">
      <SectionHeading title="Requests you sent" count={lists.outgoing.length} />
      {lists.outgoing.length === 0 ? (
        <EmptyNote>Nothing pending.</EmptyNote>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[1.5rem] bg-surface ring-1 ring-line/70">
          {lists.outgoing.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <PersonSummary item={{ ...item, message: undefined }} compact />
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-faint">
                  Sent {formatDate(item.createdAt)}
                </span>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => runAction(item, { method: "DELETE" })}
                  className="text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const connected = (
    <section className="order-2 lg:order-none">
      <SectionHeading
        title="Your connections"
        count={lists.connections.length}
      />
      {lists.connections.length === 0 ? (
        <EmptyNote>
          No connections yet. Send a request from{" "}
          <Link href="/recommendations" className="font-semibold text-brand">
            your matches
          </Link>
          ; once they accept, you can message each other.
        </EmptyNote>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {lists.connections.map((item, index) => {
            const confirming = confirmingId === item.id;

            return (
              <li
                key={item.id}
                style={{ animationDelay: `${index * 60}ms` }}
                className="panel flex animate-rise flex-col p-5 sm:p-5"
              >
                <PersonSummary item={{ ...item, message: undefined }} />
                <div className="mt-auto pt-5">
                  {confirming ? (
                    <div className="animate-fade rounded-2xl bg-danger-soft p-3">
                      <p className="text-sm text-danger">
                        Remove {item.user.name}? Your messages with them will be
                        deleted.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => runAction(item, { method: "DELETE" })}
                          className="btn bg-danger text-white hover:bg-danger/90"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="btn btn-quiet"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Link
                        href={`/messages?c=${item.id}`}
                        className="btn btn-ink flex-1"
                      >
                        Message
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => setConfirmingId(item.id)}
                        className="btn btn-quiet"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Connections</h1>
        <p className="page-lede">
          Requests you’ve received and sent, and the people you’re connected
          with. Find new people on{" "}
          <Link
            href="/recommendations"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            your matches
          </Link>
          .
        </p>
      </header>

      {message && (
        <p role="alert" className="alert-error mt-6">
          {message}
        </p>
      )}

      {loading ? (
        <div className="mt-10 grid gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="skeleton h-36 rounded-[1.75rem]" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_380px]">
          {connected}
          <div className="contents lg:flex lg:flex-col lg:gap-10">
            {received}
            {sent}
          </div>
        </div>
      )}
    </main>
  );
}
