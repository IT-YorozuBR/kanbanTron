"use client";

import { useState, useTransition } from "react";
import { setupInitialAdmin } from "@/lib/auth-actions";

export function SetupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await setupInitialAdmin({ email, password });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Email
        </label>
        <input
          type="email"
          className="aero-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Senha
        </label>
        <input
          type="password"
          className="aero-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <button type="submit" disabled={pending} className="aero-button mt-1 w-full justify-center">
        {pending ? "Criando..." : "Criar conta admin"}
      </button>
    </form>
  );
}
