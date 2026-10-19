"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

interface RegisterResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      role: string;
    };
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

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    // Client-side checks mirror the backend registerSchema (min 8 chars),
    // so the user gets a specific message instead of "Invalid registration data."
    if (!passwordLongEnough) {
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
      await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      setToken();

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
    <AuthShell
      title="Create your account"
      lede="Next you’ll set up your profile and say what you need right now."
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
            autoComplete="new-password"
            aria-describedby="password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            required
          />
          <p
            id="password-hint"
            className={`hint flex items-center gap-1.5 transition-colors ${
              passwordLongEnough ? "text-ok" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                passwordLongEnough ? "bg-ok" : "bg-line-strong"
              }`}
            />
            At least {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="label">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
          {isSubmitting ? "Creating account" : "Create account"}
        </button>

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
