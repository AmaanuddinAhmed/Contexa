"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      localStorage.setItem("contexa_token", response.data.token);

      setMessage("Login successful.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
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
          className="w-full rounded bg-black p-3 text-white"
        >
          Login
        </button>

        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
