"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

interface RegisterResponse {
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

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    // Client-side checks mirror the backend registerSchema (min 8 chars),
    // so the user gets a specific message instead of "Invalid registration data."
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      setToken(response.data.token);

      // A new account has no profile or context yet, so start onboarding at /profile.
      router.push("/profile?onboarding=1");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Registration failed.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-3xl font-bold">Create a CONTEXA account</h1>

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
          placeholder={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded border p-3"
          required
        />

        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded border p-3"
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-black p-3 text-white disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>

        {message && <p>{message}</p>}

        <p className="text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-black underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
