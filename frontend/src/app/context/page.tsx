"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Context {
  goal: string;
  need: string[];
  activity: string;
  availability: string;
  situation: string;
  interactionPreference: string;
}

interface ContextResponse {
  success: boolean;
  data: {
    context: Context | null;
  };
}

export default function ContextPage() {
  const [goal, setGoal] = useState("");
  const [need, setNeed] = useState("");
  const [activity, setActivity] = useState("");
  const [availability, setAvailability] = useState("");
  const [situation, setSituation] = useState("");
  const [interactionPreference, setInteractionPreference] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContext = async () => {
      const token = localStorage.getItem("contexa_token");

      if (!token) {
        setMessage("Please log in first.");
        setLoading(false);
        return;
      }

      try {
        const response = await api<ContextResponse>("/context", {
          token,
        });

        const context = response.data.context;

        if (context) {
          setGoal(context.goal);
          setNeed(context.need.join(", "));
          setActivity(context.activity);
          setAvailability(context.availability);
          setSituation(context.situation);
          setInteractionPreference(context.interactionPreference);
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to load context.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = localStorage.getItem("contexa_token");

    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    try {
      await api("/context", {
        method: "POST",
        token,
        body: JSON.stringify({
          goal,
          need: need
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          activity,
          availability,
          situation,
          interactionPreference,
        }),
      });

      setMessage("Context saved successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save context.",
      );
    }
  };

  if (loading) {
    return <main className="p-8">Loading context...</main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Your Current Context</h1>

      <p className="mb-8 text-gray-600">
        Tell CONTEXA what you need right now.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block font-medium">
            What is your current goal?
          </label>

          <input
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="Find a project partner"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">What do you need?</label>

          <input
            value={need}
            onChange={(event) => setNeed(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="React developer, UI designer"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            What are you currently doing?
          </label>

          <input
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="Working on a university project"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            When are you available?
          </label>

          <input
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="Weekends"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Describe your situation
          </label>

          <textarea
            value={situation}
            onChange={(event) => setSituation(event.target.value)}
            className="w-full rounded border p-3"
            rows={4}
            placeholder="I need someone to collaborate with..."
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Interaction preference
          </label>

          <select
            value={interactionPreference}
            onChange={(event) => setInteractionPreference(event.target.value)}
            className="w-full rounded border p-3"
            required
          >
            <option value="">Select one</option>
            <option value="Online">Online</option>
            <option value="In-person">In-person</option>
            <option value="Either">Either</option>
          </select>
        </div>

        <button type="submit" className="rounded bg-black px-6 py-3 text-white">
          Save Context
        </button>

        {message && <p className="text-sm">{message}</p>}
      </form>
    </main>
  );
}
