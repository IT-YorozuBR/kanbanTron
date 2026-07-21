"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoard } from "@/lib/actions";
import { ACCENT_OPTIONS, DEFAULT_ACCENT, accentSwatchVar, type AccentId } from "@/lib/theme";
import type { BoardSummary } from "@/lib/types";
import { BoardCard } from "@/components/boards/board-card";

export function BoardsList({ initialBoards }: { initialBoards: BoardSummary[] }) {
  const [boards, setBoards] = useState(initialBoards);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [accent, setAccent] = useState<AccentId>(DEFAULT_ACCENT);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createBoard({ title: trimmed, accent });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/boards/${res.data.id}`);
    });
  }

  function handleDeleted(boardId: string) {
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} onDeleted={handleDeleted} />
      ))}

      {creating ? (
        <div className="aero-glass flex flex-col gap-3 p-4">
          <input
            autoFocus
            className="aero-input font-semibold"
            placeholder="Nome do quadro"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <div className="flex items-center gap-1.5" role="group" aria-label="Cor do quadro">
            {ACCENT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAccent(option.id)}
                aria-label={option.label}
                aria-pressed={accent === option.id}
                className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: accentSwatchVar(option.id),
                  borderColor: accent === option.id ? "var(--foreground)" : "transparent",
                }}
              />
            ))}
          </div>
          {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={pending} className="aero-button flex-1">
              Criar
            </button>
            <button type="button" onClick={() => setCreating(false)} className="aero-button aero-button-ghost">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="aero-glass flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-black/60 transition-transform hover:scale-[1.02] dark:text-white/60"
        >
          <svg width="22" height="22" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold">Novo quadro</span>
        </button>
      )}
    </div>
  );
}
