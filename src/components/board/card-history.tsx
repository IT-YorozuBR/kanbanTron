import Image from "next/image";
import { decodeOptions } from "@/lib/field-options";
import type { AttachmentData, ColumnWithCards, FieldType, FieldValueData } from "@/lib/types";

export function CardHistoryEntry({
  column,
  values,
  onOpenAttachment,
}: {
  column: ColumnWithCards;
  values: FieldValueData[];
  onOpenAttachment: (attachment: AttachmentData) => void;
}) {
  return (
    <div className="aero-card p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/60 dark:text-white/60">
        {column.title}
      </p>
      <div className="flex flex-col gap-2">
        {values.map((value) => (
          <HistoryValue key={value.id} value={value} onOpenAttachment={onOpenAttachment} />
        ))}
      </div>
    </div>
  );
}

function HistoryValue({
  value,
  onOpenAttachment,
}: {
  value: FieldValueData;
  onOpenAttachment: (attachment: AttachmentData) => void;
}) {
  const type = value.fieldDefinition.type as FieldType;

  return (
    <div>
      <p className="text-[11px] font-semibold text-black/45 dark:text-white/45">{value.fieldDefinition.label}</p>
      {type === "short_text" || type === "long_text" ? (
        <p className="whitespace-pre-wrap text-sm">{value.textValue || "-"}</p>
      ) : null}
      {(type === "single_choice" || type === "multi_choice") && (
        <div className="flex flex-wrap gap-1">
          {decodeOptions(value.choiceValue).map((opt) => (
            <span
              key={opt}
              className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/70 dark:bg-white/10 dark:text-white/70"
            >
              {opt}
            </span>
          ))}
        </div>
      )}
      {type === "attachment" && value.attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.attachments.map((attachment) => (
            <div
              key={attachment.id}
              onClick={() => onOpenAttachment(attachment)}
              className="relative mt-1 h-16 w-16 cursor-pointer overflow-hidden rounded-lg border border-white/50"
            >
              {attachment.mimeType.startsWith("video/") ? (
                <>
                  <video src={`/media/${attachment.filename}`} muted preload="metadata" className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white" aria-hidden="true">
                      <path d="M4 2.5v11l10-5.5-10-5.5Z" />
                    </svg>
                  </div>
                </>
              ) : (
                <Image src={`/media/${attachment.filename}`} alt={attachment.originalName} fill sizes="64px" className="object-cover" />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
