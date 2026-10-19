"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { safeNextPath, setToken } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      role: string;
    };
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
      // The server sets the httpOnly session cookie on success.
      await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      setToken();

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
    <AuthShell
      title="Welcome back"
      lede="Log in to see who matches what you’re working on."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            required
          />
        </div>

        {message && (
          <p role="alert" className="alert-error">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full py-3 text-[0.95rem]"
        >
          {isSubmitting ? "Logging in" : "Log in"}
        </button>

        <p className="text-center text-sm text-muted">
          New to Contexa?{" "}
          <Link
            href="/register"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}