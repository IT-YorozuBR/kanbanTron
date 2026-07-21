"use client";

import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardWithAttachments } from "@/lib/types";

export function CardItem({ card, onOpen }: { card: CardWithAttachments; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`aero-card cursor-pointer p-3 ${isDragging ? "aero-dragging" : ""}`}
    >
      <CardBody card={card} />
    </div>
  );
}

export function CardPreview({ card, overlay }: { card: CardWithAttachments; overlay?: boolean }) {
  return (
    <div className={`aero-card w-72 p-3 ${overlay ? "rotate-2 shadow-2xl" : ""}`}>
      <CardBody card={card} />
    </div>
  );
}

function CardBody({ card }: { card: CardWithAttachments }) {
  const cover = card.attachments[0];
  return (
    <div className="relative flex flex-col gap-2">
      {cover ? (
        <div className="relative h-28 w-full overflow-hidden rounded-lg">
          {cover.mimeType.startsWith("video/") ? (
            <video src={`/media/${cover.filename}`} muted preload="metadata" className="h-full w-full object-cover" />
          ) : (
            <Image
              src={`/media/${cover.filename}`}
              alt={cover.originalName}
              fill
              sizes="288px"
              className="object-cover"
            />
          )}
        </div>
      ) : null}
      <p className="text-sm font-semibold leading-snug">{card.title}</p>
      {card.description ? (
        <p className="line-clamp-2 text-xs text-black/60 dark:text-white/60">{card.description}</p>
      ) : null}
      {card.attachments.length > 0 ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="5.5" cy="6.5" r="1" fill="currentColor" />
            <path d="M3 11.5L6.5 8.5L9 10.5L11 8.5L13 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {card.attachments.length}
        </span>
      ) : null}
    </div>
  );
}
