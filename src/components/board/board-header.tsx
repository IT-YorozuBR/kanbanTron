"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteBoard, updateBoard } from "@/lib/actions";
import { ACCENT_OPTIONS, accentSwatchVar, type AccentId } from "@/lib/theme";

export function BoardHeader({ board }: { board: { id: string; title: string; accent: string } }) {
  const [title, setTitle] = useState(board.title);
  const [accent, setAccent] = useState(board.accent);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function saveTitle() {
    const trimmed = title.trim();
    setEditing(false);
    if (!trimmed || trimmed === board.title) {
      setTitle(board.title);
      return;
    }
    startTransition(async () => {
      const res = await updateBoard({ boardId: board.id, title: trimmed });
      if (!res.ok) router.refresh();
    });
  }

  function changeAccent(next: AccentId) {
    setAccent(next);
    startTransition(async () => {
      const res = await updateBoard({ boardId: board.id, accent: next });
      if (!res.ok) router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir o quadro "${board.title}" e tudo que ele contem?`)) return;
    startTransition(async () => {
      const res = await deleteBoard({ boardId: board.id });
      if (res.ok) router.push("/");
      else router.refresh();
    });
  }

  return (
    <header className="aero-glass flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href="/"
          aria-label="Voltar para meus quadros"
          className="rounded-full p-2 text-black/50 hover:bg-black/10 dark:text-white/60 dark:hover:bg-white/10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M9.5 3L4.5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: accentSwatchVar(accent) }}
          aria-hidden="true"
        />
        {editing ? (
          <input
            autoFocus
            className="aero-input min-w-0 flex-1 text-lg font-extrabold"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitle(board.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-w-0 truncate text-left text-xl font-extrabold tracking-tight"
            title="Renomear quadro"
          >
            {title}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Cor do quadro">
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => changeAccent(option.id)}
              aria-label={option.label}
              aria-pressed={accent === option.id}
              disabled={pending}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: accentSwatchVar(option.id),
                borderColor: accent === option.id ? "var(--foreground)" : "transparent",
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="aero-button aero-button-berry text-xs"
        >
          Excluir quadro
        </button>
      </div>
    </header>
  );
}
