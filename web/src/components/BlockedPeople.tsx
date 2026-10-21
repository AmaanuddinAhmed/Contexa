"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Avatar from "@/components/Avatar";

interface BlockedPerson {
  userId: string;
  name: string;
  role?: string;
  avatarUrl: string | null;
  blockedAt: string;
}

interface BlocksResponse {
  data: { blocked: BlockedPerson[] };
}

/** People you blocked, with Unblock. Shows nothing until you block someone. */
export default function BlockedPeople() {
  const [people, setPeople] = useState<BlockedPerson[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    api<BlocksResponse>("/blocks", { token: getToken() ?? undefined })
      .then((response) => {
        if (!cancelled) setPeople(response.data.blocked);
      })
      .catch(() => {
        // Optional section; leave it hidden.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const unblock = async (person: BlockedPerson) => {
    setBusyId(person.userId);
    setError("");

    try {
      await api(`/blocks/${person.userId}`, {
        method: "DELETE",
        token: getToken() ?? undefined,
      });
      setPeople((list) => list.filter((item) => item.userId !== person.userId));
    } catch (unblockError) {
      setError(
        unblockError instanceof Error
          ? unblockError.message
          : "Something went wrong.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (people.length === 0 && !error) {
    return null;
  }

  return (
    <section
      className="panel mt-6 animate-rise sm:p-9"
      aria-labelledby="blocked-heading"
    >
      <h2 id="blocked-heading" className="text-xl font-semibold">
        Blocked people
      </h2>
      <p className="mt-1 text-sm text-muted">
        You and they can&apos;t see each other in matches or send requests.
        Unblocking doesn&apos;t bring back a removed connection or messages.
      </p>

      {error && (
        <p role="alert" className="alert-error mt-4">
          {error}
        </p>
      )}

      <ul className="mt-5 divide-y divide-line">
        {people.map((person) => (
          <li
            key={person.userId}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={person.avatarUrl} name={person.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{person.name}</p>
                {person.role && (
                  <p className="truncate text-sm text-muted">{person.role}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === person.userId}
              onClick={() => unblock(person)}
              className="btn btn-quiet shrink-0 px-4 py-2"
            >
              {busyId === person.userId ? "Unblocking" : "Unblock"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
