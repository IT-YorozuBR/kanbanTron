"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBoard } from "@/lib/actions";
import { accentSwatchVar } from "@/lib/theme";
import type { BoardSummary } from "@/lib/types";

export function BoardCard({
  board,
  onDeleted,
  canDelete,
}: {
  board: BoardSummary;
  onDeleted: (boardId: string) => void;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir o quadro "${board.title}" e tudo que ele contem?`)) return;
    onDeleted(board.id);
    startTransition(async () => {
      const res = await deleteBoard({ boardId: board.id });
      if (!res.ok) router.refresh();
    });
  }

  return (
    <Link href={`/boards/${board.id}`} className="group block">
      <div className="aero-card relative flex h-full flex-col gap-3 p-4">
        <div
          className="h-1.5 w-12 rounded-full"
          style={{ background: accentSwatchVar(board.accent) }}
          aria-hidden="true"
        />
        <h2 className="truncate text-base font-bold leading-snug">{board.title}</h2>
        <p className="text-xs text-black/55 dark:text-white/55">
          {board.columnCount} {board.columnCount === 1 ? "fase" : "fases"} · {board.cardCount}{" "}
          {board.cardCount === 1 ? "card" : "cards"}
        </p>
        <span className="w-fit rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
          {board.sectorName}
        </span>
        {canDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            aria-label="Excluir quadro"
            className="absolute right-3 top-3 rounded-full p-1.5 text-black/35 opacity-0 transition-opacity hover:bg-black/10 hover:text-black/70 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </Link>
  );
}
