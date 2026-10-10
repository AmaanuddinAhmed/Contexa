"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { safeNextPath, setToken } from "@/lib/auth";

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      role: string;
    };
    token: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      setToken(response.data.token);

      // Return to the page that sent the user here, if any.
      const next = safeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.push(next ?? "/recommendations");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-3xl font-bold">CONTEXA Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border p-3"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded border p-3"
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-black p-3 text-white disabled:opacity-60"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

        {message && <p>{message}</p>}

        <p className="text-sm text-zinc-600">
          New to CONTEXA?{" "}
          <Link href="/register" className="font-medium text-black underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
