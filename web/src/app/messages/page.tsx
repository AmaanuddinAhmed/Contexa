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
  mergeMessages,
  MESSAGE_MAX_LENGTH,
  MESSAGES_READ_EVENT,
  MessagesResponse,
  SendMessageResponse,
  threadPollDelay,
  UNREAD_POLL_MS,
  UnreadResponse,
} from "@/lib/messages";
import { useAdaptivePolling, usePolling } from "@/lib/usePolling";

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

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Thread({
  connection,
  onBack,
}: {
  connection: ConnectionItem;
  onBack: () => void;
}) {
  const conversationPath = `/messages/${connection.id}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 md:hidden"
          aria-label="Back to conversations"
        >
          ←
        </button>

        <Avatar name={user.name} />

        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-950">{user.name}</p>
          <p className="truncate text-xs text-zinc-500">
            {[user.role, user.education].filter(Boolean).join(" · ") ||
              "Connected"}
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current =
            list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-zinc-50 px-4 py-4"
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            {hasMore && (
              <div className="pb-2 text-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {loadingOlder ? "Loading…" : "Load older messages"}
                </button>
              </div>
            )}

            {messages.length === 0 && !error && (
              <p className="py-10 text-center text-sm text-zinc-500">
                No messages yet. Say hello to {user.name}.
              </p>
            )}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay =
                !previous || !isSameDay(previous.createdAt, message.createdAt);

              return (
                <div key={message.id}>
                  {newDay && (
                    <p className="py-2 text-center text-xs font-medium text-zinc-400">
                      {formatDay(message.createdAt)}
                    </p>
                  )}

                  <div
                    className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                        message.mine
                          ? "rounded-br-sm bg-zinc-900 text-white"
                          : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {message.body}
                      </p>
                      <p
                        className={`mt-1 text-right text-[11px] ${
                          message.mine ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {formatTime(message.createdAt)}
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
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-zinc-200 bg-white p-3"
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
          rows={2}
          placeholder={`Message ${user.name}`}
          className="min-h-0 flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
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

  usePolling(refreshUnread, UNREAD_POLL_MS);

  const selected = connections.find((item) => item.id === selectedId) ?? null;

  const open = (connectionId: string | null) =>
    router.replace(connectionId ? `/messages?c=${connectionId}` : "/messages", {
      scroll: false,
    });

  return (
    <main className="flex-1 bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-zinc-950">
          Messages
        </h1>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="grid h-[70vh] min-h-[420px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:grid-cols-[280px_1fr]">
          <aside
            className={`min-h-0 overflow-y-auto border-zinc-200 md:block md:border-r ${
              selected ? "hidden" : "block"
            }`}
          >
            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-14 animate-pulse rounded-xl bg-zinc-100"
                  />
                ))}
              </div>
            ) : connections.length === 0 ? (
              <p className="p-6 text-sm text-zinc-500">
                You can message people once they accept your connection request.
                Find people on the{" "}
                <Link href="/recommendations" className="font-medium underline">
                  Recommendations
                </Link>{" "}
                page.
              </p>
            ) : (
              <ul className="p-2">
                {connections.map((item) => {
                  const count = unread[item.id] ?? 0;
                  const isActive = item.id === selectedId;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => open(item.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                          isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                        }`}
                      >
                        <Avatar name={item.user.name} />

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm ${
                              count > 0
                                ? "font-bold text-zinc-950"
                                : "font-medium text-zinc-900"
                            }`}
                          >
                            {item.user.name}
                          </span>
                          <span className="block truncate text-xs text-zinc-500">
                            {item.user.role || "Connected"}
                          </span>
                        </span>

                        {count > 0 && (
                          <span
                            className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white"
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
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
                {!loading && selectedId
                  ? "This conversation is no longer available."
                  : "Choose a conversation."}
              </div>
            )}
          </div>
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
