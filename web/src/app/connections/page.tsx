"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ConnectionItem, ConnectionsResponse } from "@/lib/connections";

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

function PersonSummary({ item }: { item: ConnectionItem }) {
  const { user } = item;

  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 font-bold text-white">
        {user.name.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0">
        <p className="font-semibold text-zinc-950">{user.name}</p>

        <p className="text-sm text-zinc-500">
          {[user.role, user.education, user.experienceLevel]
            .filter(Boolean)
            .join(" · ") || "No details yet"}
        </p>

        {user.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.skills.slice(0, 5).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {item.message && (
          <p className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm italic text-zinc-600">
            “{item.message}”
          </p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  emptyText,
  items,
  renderActions,
}: {
  title: string;
  emptyText: string;
  items: ConnectionItem[];
  renderActions: (item: ConnectionItem) => React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">
        {title}{" "}
        <span className="text-sm font-normal text-zinc-500">
          ({items.length})
        </span>
      </h2>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
            >
              <PersonSummary item={item} />

              <div className="flex shrink-0 items-center gap-2">
                {renderActions(item)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ConnectionsPage() {
  const [lists, setLists] = useState<Lists>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  // Id of the record an action is running on, to disable its buttons.
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const runAction = async (
    item: ConnectionItem,
    request: { method: "PATCH" | "DELETE"; body?: object },
  ) => {
    setBusyId(item.id);
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
  };

  const buttonClass =
    "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50";

  if (loading) {
    return (
      <main className="flex-1 bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
          Connections
        </h1>

        <p className="mt-3 mb-10 text-zinc-600">
          Requests you have received and sent, and the people you are connected
          with. Find new people on the{" "}
          <Link href="/recommendations" className="font-medium underline">
            Recommendations
          </Link>{" "}
          page.
        </p>

        {message && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {message}
          </p>
        )}

        <Section
          title="Requests received"
          emptyText="No pending requests."
          items={lists.incoming}
          renderActions={(item) => (
            <>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() =>
                  runAction(item, {
                    method: "PATCH",
                    body: { action: "accept" },
                  })
                }
                className={`${buttonClass} bg-black text-white hover:bg-zinc-800`}
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
                className={`${buttonClass} border border-zinc-200 text-zinc-900 hover:bg-zinc-50`}
              >
                Decline
              </button>
            </>
          )}
        />

        <Section
          title="Requests sent"
          emptyText="You have no pending requests."
          items={lists.outgoing}
          renderActions={(item) => (
            <>
              <span className="text-xs text-zinc-500">
                Sent {formatDate(item.createdAt)}
              </span>

              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => runAction(item, { method: "DELETE" })}
                className={`${buttonClass} border border-zinc-200 text-zinc-900 hover:bg-zinc-50`}
              >
                Cancel
              </button>
            </>
          )}
        />

        <Section
          title="Your connections"
          emptyText="No connections yet."
          items={lists.connections}
          renderActions={(item) => (
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${item.user.name} from your connections?`,
                  )
                ) {
                  runAction(item, { method: "DELETE" });
                }
              }}
              className={`${buttonClass} border border-zinc-200 text-zinc-600 hover:bg-zinc-50`}
            >
              Remove
            </button>
          )}
        />
      </div>
    </main>
  );
}
