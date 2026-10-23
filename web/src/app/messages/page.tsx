"use client";

import {
  FormEvent,
  KeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ConnectionItem, ConnectionsResponse } from "@/lib/connections";
import {
  ChatMessage,
  isSeen,
  mergeMessages,
  MESSAGE_MAX_LENGTH,
  MESSAGES_READ_EVENT,
  MessagesResponse,
  SendMessageResponse,
  threadPollDelay,
  UnreadResponse,
} from "@/lib/messages";
import { useConnectionsChanged, useUnreadChanged } from "@/lib/notifications";
import { useAdaptivePolling } from "@/lib/usePolling";
import Avatar from "@/components/Avatar";
import SafetyActions from "@/components/SafetyActions";

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const formatDay = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const isSameDay = (first: string, second: string) =>
  new Date(first).toDateString() === new Date(second).toDateString();

/** One tick: sent. Two ticks: the other person has read it. */
function ReadTicks({ seen }: { seen: boolean }) {
  return (
    <span
      className={`inline-flex ${seen ? "text-white" : "text-white/60"}`}
      role="img"
      aria-label={seen ? "Seen" : "Sent"}
      title={seen ? "Seen" : "Sent"}
    >
      <svg
        viewBox="0 0 18 12"
        className="h-3 w-[18px]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.5 6.5l3 3 6.5-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {seen && (
          <path
            d="M7.5 9.5l.5.5 6.5-7.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}

function Thread({
  connection,
  onBack,
  onBlocked,
}: {
  connection: ConnectionItem;
  onBack: () => void;
  onBlocked: () => void;
}) {
  const conversationPath = `/messages/${connection.id}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Read receipts: the other person has read my messages up to this time.
  const [seenUpTo, setSeenUpTo] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  // Follow new messages only while the reader is at the bottom.
  const stickToBottom = useRef(true);
  // Height before older messages were added on top, to keep the view still.
  const heightBeforeOlder = useRef<number | null>(null);
  // Latest list, for the poll (which must not restart on every message).
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    if (heightBeforeOlder.current !== null) {
      list.scrollTop += list.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  // First load: the latest page. Opening it marks it read on the server.
  useEffect(() => {
    let cancelled = false;

    api<MessagesResponse>(conversationPath, { token: getToken() ?? undefined })
      .then((response) => {
        if (!cancelled) {
          setMessages(response.data.messages);
          setHasMore(response.data.hasMore);
          setSeenUpTo(response.data.seenUpTo);
          window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(errorText(loadError, "Unable to load messages."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationPath]);

  // Returns true when something new arrived, which keeps polling fast.
  const poll = useCallback(async (): Promise<boolean> => {
    const known = messagesRef.current;
    const latest = known.at(-1)?.createdAt;
    const query = latest ? `?after=${encodeURIComponent(latest)}` : "";

    try {
      const response = await api<MessagesResponse>(
        `${conversationPath}${query}`,
        { token: getToken() ?? undefined },
      );
      const knownIds = new Set(known.map((message) => message.id));
      const fresh = response.data.messages.filter(
        (message) => !knownIds.has(message.id),
      );

      setError("");
      setSeenUpTo(response.data.seenUpTo);

      if (fresh.length > 0) {
        setMessages((current) => mergeMessages(current, fresh));

        if (fresh.some((message) => !message.mine)) {
          window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
        }
      }

      return fresh.length > 0;
    } catch (pollError) {
      setError(errorText(pollError, "Unable to load new messages."));
      return false;
    }
  }, [conversationPath]);

  // Every second during a live chat, backing off to 10 s when quiet.
  const markActive = useAdaptivePolling(poll, threadPollDelay, !loading);

  const loadOlder = async () => {
    const oldest = messages[0]?.createdAt;

    if (!oldest) {
      return;
    }

    setLoadingOlder(true);

    try {
      const response = await api<MessagesResponse>(
        `${conversationPath}?before=${encodeURIComponent(oldest)}`,
        { token: getToken() ?? undefined },
      );

      heightBeforeOlder.current = listRef.current?.scrollHeight ?? null;
      setMessages((current) => mergeMessages(current, response.data.messages));
      setHasMore(response.data.hasMore);
    } catch (olderError) {
      setError(errorText(olderError, "Unable to load older messages."));
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const body = draft.trim();

    if (!body || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await api<SendMessageResponse>(conversationPath, {
        method: "POST",
        token: getToken() ?? undefined,
        body: JSON.stringify({ body }),
      });

      stickToBottom.current = true;
      setMessages((current) => mergeMessages(current, [response.data.message]));
      setDraft("");
      markActive();
    } catch (sendError) {
      setError(errorText(sendError, "Unable to send message."));
    } finally {
      setSending(false);
    }
  };

  // Enter sends; Shift+Enter starts a new line.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const { user } = connection;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunk hover:text-ink md:hidden"
          aria-label="Back to conversations"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 3.5L5.5 8l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <Avatar src={user.avatarUrl} name={user.name} size="sm" />

        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight font-semibold">
            {user.name}
          </p>
          <p className="truncate text-xs text-muted">
            {user.isSample
              ? "Sample profile, won’t reply"
              : [user.role, user.education].filter(Boolean).join(", ") ||
                "Connected"}
          </p>
        </div>
        <SafetyActions
          userId={user.userId}
          name={user.name}
          onDone={onBlocked}
          className="ml-auto shrink-0"
          panelClassName="basis-full"
        />
      </header>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current =
            list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-sunk/60 px-3 py-4 sm:px-5"
      >
        {loading ? (
          <div
            className="space-y-3 py-4"
            aria-busy="true"
            aria-label="Loading messages"
          >
            <div className="skeleton h-10 w-2/3 rounded-2xl" />
            <div className="skeleton ml-auto h-10 w-1/2 rounded-2xl" />
            <div className="skeleton h-10 w-3/5 rounded-2xl" />
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="pb-2 text-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="btn btn-quiet px-3.5 py-1.5 text-xs"
                >
                  {loadingOlder ? "Loading" : "Load older messages"}
                </button>
              </div>
            )}

            {messages.length === 0 && !error && (
              <div className="flex flex-col items-center py-14 text-center">
                <Avatar src={user.avatarUrl} name={user.name} size="lg" />
                <p className="mt-4 font-display text-xl font-semibold">
                  You and {user.name} are connected
                </p>
                <p className="mt-1 text-sm text-muted">
                  {user.isSample
                    ? "This is a sample profile, so it won’t reply."
                    : "Say hello and mention what you’d like to work on."}
                </p>
              </div>
            )}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay =
                !previous || !isSameDay(previous.createdAt, message.createdAt);
              const grouped =
                !newDay && previous && previous.mine === message.mine;

              return (
                <div key={message.id} className={grouped ? "" : "pt-1.5"}>
                  {newDay && (
                    <p className="py-3 text-center">
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted ring-1 ring-line">
                        {formatDay(message.createdAt)}
                      </span>
                    </p>
                  )}

                  <div
                    className={`flex animate-fade ${message.mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-[1.25rem] px-4 py-2.5 sm:max-w-[70%] ${
                        message.mine
                          ? "rounded-br-md bg-brand text-white"
                          : "rounded-bl-md bg-surface text-ink shadow-[var(--shadow-lift)] ring-1 ring-line/60"
                      }`}
                    >
                      <p className="text-[0.95rem] leading-6 wrap-anywhere whitespace-pre-wrap">
                        {message.body}
                      </p>
                      <p
                        className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums ${
                          message.mine ? "text-white/70" : "text-faint"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                        {message.mine && (
                          <ReadTicks seen={isSeen(message, seenUpTo)} />
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="border-t border-danger/20 bg-danger-soft px-4 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-line bg-surface p-2.5 sm:p-3"
      >
        <label htmlFor="message-draft" className="sr-only">
          Message {user.name}
        </label>
        <textarea
          id="message-draft"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            markActive();
          }}
          onKeyDown={handleKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={1}
          placeholder={`Message ${user.name}`}
          className="field max-h-40 min-h-12 flex-1 resize-none [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label={sending ? "Sending" : "Send"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_18px_-8px_rgb(51_82_255/0.7)] transition-all duration-300 ease-[var(--ease-spring)] hover:bg-brand-deep active:scale-95 disabled:bg-line-strong disabled:shadow-none"
        >
          <svg
            viewBox="0 0 16 16"
            className={`h-4 w-4 transition-transform duration-300 ${sending ? "translate-x-0.5 -translate-y-0.5" : ""}`}
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 8h10M8.5 3.5L13 8l-4.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </section>
  );
}

function MessagesView() {
  const router = useRouter();
  const selectedId = useSearchParams().get("c");

  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    api<ConnectionsResponse>("/connections", { token: getToken() ?? undefined })
      .then((response) => {
        if (!cancelled) {
          setConnections(response.data.connections);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(errorText(loadError, "Unable to load conversations."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // A request was accepted (new conversation) or a connection removed.
  useConnectionsChanged(() => {
    api<ConnectionsResponse>("/connections", { token: getToken() ?? undefined })
      .then((response) => setConnections(response.data.connections))
      .catch(() => {
        // The next change retries.
      });
  });

  const refreshUnread = useCallback(async () => {
    try {
      const response = await api<UnreadResponse>("/messages", {
        token: getToken() ?? undefined,
      });
      setUnread(response.data.byConnection);
    } catch {
      // Badges are a convenience; the next refresh retries.
    }
  }, []);

  useEffect(() => {
    const onRead = () => void refreshUnread();

    onRead();
    window.addEventListener(MESSAGES_READ_EVENT, onRead);

    return () => window.removeEventListener(MESSAGES_READ_EVENT, onRead);
  }, [refreshUnread]);

  // The header's poll notices new messages; per-conversation counts follow.
  useUnreadChanged(() => void refreshUnread());

  const selected = connections.find((item) => item.id === selectedId) ?? null;

  const open = (connectionId: string | null) =>
    router.replace(connectionId ? `/messages?c=${connectionId}` : "/messages", {
      scroll: false,
    });

  return (
    <main className="page pb-6 sm:pb-10">
      <h1 className={`page-title mb-6 ${selected ? "hidden md:block" : ""}`}>
        Messages
      </h1>

      {error && (
        <p role="alert" className="alert-error mb-6">
          {error}
        </p>
      )}

      <div className="grid h-[calc(100dvh-8.5rem)] min-h-[440px] overflow-hidden rounded-[1.75rem] bg-surface shadow-[var(--shadow-lift)] ring-1 ring-line/70 md:h-[72vh] md:grid-cols-[300px_1fr]">
        <aside
          className={`min-h-0 overflow-y-auto border-line md:block md:border-r ${
            selected ? "hidden" : "block"
          }`}
          aria-label="Conversations"
        >
          {loading ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {[1, 2, 3].map((item) => (
                <div key={item} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="p-6">
              <p className="font-display text-lg font-semibold">
                No conversations yet
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                You can message people once they accept your connection request.
              </p>
              <Link href="/recommendations" className="btn btn-primary mt-4">
                Find people to connect with
              </Link>
            </div>
          ) : (
            <ul className="space-y-0.5 p-2">
              {connections.map((item) => {
                const count = unread[item.id] ?? 0;
                const isActive = item.id === selectedId;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => open(item.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors duration-200 ${
                        isActive ? "bg-brand-soft" : "hover:bg-sunk"
                      }`}
                    >
                      <Avatar
                        src={item.user.avatarUrl}
                        name={item.user.name}
                        size="sm"
                      />

                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[0.95rem] ${
                            count > 0
                              ? "font-bold text-ink"
                              : "font-medium text-ink-soft"
                          }`}
                        >
                          {item.user.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {item.user.isSample
                            ? "Sample profile"
                            : item.user.role || "Connected"}
                        </span>
                      </span>

                      {count > 0 && (
                        <span
                          className="inline-flex min-w-6 items-center justify-center rounded-full bg-signal px-1.5 text-xs leading-6 font-bold text-ink tabular-nums"
                          aria-label={`${count} unread`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className={`min-h-0 md:block ${selected ? "block" : "hidden"}`}>
          {selected ? (
            // Keyed so each conversation starts with fresh state.
            <Thread
              key={selected.id}
              connection={selected}
              onBack={() => open(null)}
              onBlocked={() => {
                setConnections((list) =>
                  list.filter((item) => item.id !== selected.id),
                );
                open(null);
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sunk text-faint ring-1 ring-line"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="text-sm text-muted">
                {!loading && selectedId
                  ? "This conversation is no longer available."
                  : "Choose a conversation."}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function MessagesPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={null}>
      <MessagesView />
    </Suspense>
  );
}
