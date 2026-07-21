"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { deleteColumn, renameColumn } from "@/lib/actions";
import type { ColumnWithCards } from "@/lib/types";
import { CardItem } from "@/components/board/card-item";
import { NewCardForm } from "@/components/board/new-card-form";

const ACCENTS = ["", "aero-button-lime", "aero-button-tangerine", "aero-button-grape", "aero-button-berry"];

function accentFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export function ColumnView({
  column,
  onColumnsChange,
  onOpenCard,
}: {
  column: ColumnWithCards;
  onColumnsChange: Dispatch<SetStateAction<ColumnWithCards[]>>;
  onOpenCard: (cardId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  const { setNodeRef: setDropRef } = useDroppable({ id: column.id, data: { type: "column" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function saveTitle() {
    const trimmed = title.trim();
    setEditing(false);
    if (!trimmed || trimmed === column.title) {
      setTitle(column.title);
      return;
    }
    onColumnsChange((prev) => prev.map((c) => (c.id === column.id ? { ...c, title: trimmed } : c)));
    startTransition(async () => {
      const res = await renameColumn({ columnId: column.id, title: trimmed });
      if (!res.ok) router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir a fase "${column.title}" e todos os cards nela?`)) return;
    onColumnsChange((prev) => prev.filter((c) => c.id !== column.id));
    startTransition(async () => {
      const res = await deleteColumn({ columnId: column.id });
      if (!res.ok) router.refresh();
    });
  }

  const accent = accentFor(column.id);
  const cardIds = column.cards.map((c) => c.id);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      style={style}
      className={`aero-glass flex w-72 shrink-0 flex-col gap-3 p-3 ${isDragging ? "aero-dragging" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab select-none rounded p-1 text-black/30 active:cursor-grabbing dark:text-white/30"
          aria-label="Arrastar fase"
          title="Arrastar fase"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="4" cy="3" r="1.4" fill="currentColor" />
            <circle cx="10" cy="3" r="1.4" fill="currentColor" />
            <circle cx="4" cy="7" r="1.4" fill="currentColor" />
            <circle cx="10" cy="7" r="1.4" fill="currentColor" />
            <circle cx="4" cy="11" r="1.4" fill="currentColor" />
            <circle cx="10" cy="11" r="1.4" fill="currentColor" />
          </svg>
        </span>
        {editing ? (
          <input
            autoFocus
            className="aero-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitle(column.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-w-0 flex-1 truncate text-left text-sm font-bold tracking-tight"
            title="Renomear fase"
          >
            {column.title}
          </button>
        )}
        <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs font-semibold text-black/60 dark:bg-white/10 dark:text-white/70">
          {column.cards.length}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Excluir fase"
          className="rounded-full p-1 text-black/40 hover:bg-black/10 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="aero-scroll flex max-h-[65dvh] min-h-16 flex-col gap-2 overflow-y-auto pr-1">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>
      </div>

      <NewCardForm
        columnId={column.id}
        accent={accent}
        onCreated={(card) =>
          onColumnsChange((prev) =>
            prev.map((c) => (c.id === column.id ? { ...c, cards: [...c.cards, card] } : c)),
          )
        }
      />
    </div>
  );
}
