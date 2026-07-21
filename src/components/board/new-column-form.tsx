"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createColumn } from "@/lib/actions";
import type { ColumnWithCards } from "@/lib/types";

export function NewColumnForm({
  boardId,
  onCreated,
}: {
  boardId: string;
  onCreated: (column: ColumnWithCards) => void;
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
      const res = await createColumn({ boardId, title: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({ id: res.data.id, title: trimmed, order: 0, boardId, cards: [], createdAt: new Date(), updatedAt: new Date() });
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
        className="aero-button aero-button-ghost aero-button-grape h-fit w-64 shrink-0 justify-center"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Nova fase
      </button>
    );
  }

  return (
    <div className="aero-glass flex w-64 shrink-0 flex-col gap-2 p-3">
      <input
        autoFocus
        className="aero-input"
        placeholder="Nome da fase"
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="aero-button aero-button-grape flex-1">
          Adicionar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="aero-button aero-button-ghost">
          Cancelar
        </button>
      </div>
    </div>
  );
}
