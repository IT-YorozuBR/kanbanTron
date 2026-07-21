"use client";

import { useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { deleteAttachment, deleteCard, updateCard, uploadAttachment } from "@/lib/actions";
import type { AttachmentData, CardWithAttachments, ColumnWithCards } from "@/lib/types";

export function CardModal({
  card,
  onClose,
  onColumnsChange,
}: {
  card: CardWithAttachments;
  onClose: () => void;
  onColumnsChange: Dispatch<SetStateAction<ColumnWithCards[]>>;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  function saveDescription() {
    if (description === (card.description ?? "")) return;
    patchCard({ description: description || null });
    startTransition(async () => {
      const res = await updateCard({ cardId: card.id, description });
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

  async function handleFileSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.set("cardId", card.id);
    formData.set("file", file);

    const res = await uploadAttachment(formData);
    setUploading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    const attachment: AttachmentData = {
      id: res.data.id,
      filename: res.data.filename,
      originalName: file.name,
      mimeType: file.type.startsWith("video/") ? file.type : "image/webp",
      size: 0,
      width: null,
      height: null,
      cardId: card.id,
      createdAt: new Date(),
    };
    patchCard({ attachments: [...card.attachments, attachment] });
    router.refresh();
  }

  function handleDeleteAttachment(attachmentId: string) {
    patchCard({ attachments: card.attachments.filter((a) => a.id !== attachmentId) });
    startTransition(async () => {
      const res = await deleteAttachment({ attachmentId });
      if (!res.ok) router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="aero-glass aero-scroll max-h-[85dvh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <input
            className="aero-input flex-1 text-base font-bold"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
          />
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

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Descricao
        </label>
        <textarea
          className="aero-input mb-4 resize-none"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          placeholder="Adicione detalhes..."
        />

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Anexos
        </label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {card.attachments.map((attachment) => (
            <div key={attachment.id} className="group relative aspect-square overflow-hidden rounded-lg border border-white/50">
              {attachment.mimeType.startsWith("video/") ? (
                <video
                  src={`/media/${attachment.filename}`}
                  controls
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={`/media/${attachment.filename}`}
                  alt={attachment.originalName}
                  fill
                  sizes="150px"
                  className="object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => handleDeleteAttachment(attachment.id)}
                aria-label="Remover anexo"
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="aero-button aero-button-lime mb-4 w-full justify-center"
        >
          {uploading ? "Enviando..." : "Anexar imagem ou video"}
        </button>
        <p className="-mt-3 mb-4 text-[11px] text-black/45 dark:text-white/45">
          Imagens ate 5MB. Videos (mp4, webm, mov) ate 80MB.
        </p>
        {error ? <p className="mb-4 text-xs font-medium text-rose-600">{error}</p> : null}

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
  );
}
