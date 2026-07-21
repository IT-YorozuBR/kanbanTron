"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSector } from "@/lib/auth-actions";

export function CreateSectorForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createSector({ name: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="aero-input"
          placeholder="Nome do setor"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={pending} className="aero-button aero-button-lime shrink-0 text-xs">
          Criar
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </form>
  );
}
