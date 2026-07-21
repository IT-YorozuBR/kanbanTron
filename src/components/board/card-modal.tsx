"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { deleteCard, updateCard } from "@/lib/actions";
import type { AttachmentData, CardWithAttachments, ColumnWithCards } from "@/lib/types";
import { CardFields } from "@/components/board/card-fields";
import { CardHistoryEntry } from "@/components/board/card-history";
import { MediaLightbox } from "@/components/board/media-lightbox";

export function CardModal({
  card,
  columns,
  onClose,
  onColumnsChange,
}: {
  card: CardWithAttachments;
  columns: ColumnWithCards[];
  onClose: () => void;
  onColumnsChange: Dispatch<SetStateAction<ColumnWithCards[]>>;
}) {
  const [title, setTitle] = useState(card.title);
  const [pending, startTransition] = useTransition();
  const [lightboxAttachment, setLightboxAttachment] = useState<AttachmentData | null>(null);
  const router = useRouter();

  const currentColumn = columns.find((c) => c.id === card.columnId);
  const currentFieldDefinitions = currentColumn?.fieldDefinitions ?? [];
  const titleField = currentFieldDefinitions.find((f) => f.isTitleField);

  const historyEntries = columns
    .filter((c) => c.id !== card.columnId)
    .map((c) => ({ column: c, values: card.fieldValues.filter((v) => v.fieldDefinition.columnId === c.id) }))
    .filter((entry) => entry.values.length > 0);

  function patchCard(patch: Partial<CardWithAttachments>) {
    onColumnsChange((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? { ...c, ...patch } : c)),
      })),
    );
  }

  function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === card.title) {
      setTitle(card.title);
      return;
    }
    patchCard({ title: trimmed });
    startTransition(async () => {
      const res = await updateCard({ cardId: card.id, title: trimmed });
      if (!res.ok) router.refresh();
    });
  }

  function handleDeleteCard() {
    if (!confirm("Excluir este card e todos os anexos?")) return;
    onColumnsChange((prev) =>
      prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== card.id) })),
    );
    onClose();
    startTransition(async () => {
      const res = await deleteCard({ cardId: card.id });
      if (!res.ok) router.refresh();
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="aero-glass flex max-h-[85dvh] w-full max-w-3xl overflow-hidden p-0"
          onClick={(e) => e.stopPropagation()}
        >
        {historyEntries.length > 0 ? (
          <div className="aero-scroll hidden w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-white/40 p-4 sm:flex dark:border-white/10">
            <h3 className="text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/50">
              Historico
            </h3>
            {historyEntries.map((entry) => (
              <CardHistoryEntry
                key={entry.column.id}
                column={entry.column}
                values={entry.values}
                onOpenAttachment={setLightboxAttachment}
              />
            ))}
          </div>
        ) : null}

        <div className="aero-scroll flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            {titleField ? (
              <h2 className="flex-1 text-base font-bold" title="Definido pelo campo marcado como titulo">
                {card.title}
              </h2>
            ) : (
              <input
                className="aero-input flex-1 text-base font-bold"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-full p-2 text-black/50 hover:bg-black/10 dark:text-white/60 dark:hover:bg-white/10"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {currentFieldDefinitions.length > 0 ? (
            <>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                Campos de &ldquo;{currentColumn?.title}&rdquo;
              </label>
              <CardFields
                card={card}
                fieldDefinitions={currentFieldDefinitions}
                patchCard={patchCard}
                onOpenAttachment={setLightboxAttachment}
              />
            </>
          ) : (
            <p className="mb-4 text-sm text-black/50 dark:text-white/50">
              Nenhum campo cadastrado nesta fase.
            </p>
          )}

          <button
            type="button"
            onClick={handleDeleteCard}
            disabled={pending}
            className="aero-button aero-button-berry w-full justify-center"
          >
            Excluir card
          </button>
        </div>
      </div>
      </div>
      {lightboxAttachment ? (
        <MediaLightbox attachment={lightboxAttachment} onClose={() => setLightboxAttachment(null)} />
      ) : null}
    </>
  );
}
