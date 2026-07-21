"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCard } from "@/lib/actions";
import type { CardWithAttachments } from "@/lib/types";

export function NewCardForm({
  columnId,
  accent,
  onCreated,
}: {
  columnId: string;
  accent: string;
  onCreated: (card: CardWithAttachments) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createCard({ columnId, title: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({
        id: res.data.id,
        title: trimmed,
        description: null,
        order: 0,
        columnId,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setTitle("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`aero-button aero-button-ghost ${accent} justify-center text-xs`}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Novo card
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        autoFocus
        rows={2}
        className="aero-input resize-none"
        placeholder="Titulo do card"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className={`aero-button ${accent} flex-1 text-xs`}>
          Adicionar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="aero-button aero-button-ghost text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}
