import Image from "next/image";
import { decodeOptions } from "@/lib/field-options";
import type { ColumnWithCards, FieldType, FieldValueData } from "@/lib/types";

export function CardHistoryEntry({
  column,
  values,
}: {
  column: ColumnWithCards;
  values: FieldValueData[];
}) {
  return (
    <div className="aero-card p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/60 dark:text-white/60">
        {column.title}
      </p>
      <div className="flex flex-col gap-2">
        {values.map((value) => (
          <HistoryValue key={value.id} value={value} />
        ))}
      </div>
    </div>
  );
}

function HistoryValue({ value }: { value: FieldValueData }) {
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
      {type === "attachment" && value.attachment ? (
        <div className="relative mt-1 h-16 w-16 overflow-hidden rounded-lg border border-white/50">
          {value.attachment.mimeType.startsWith("video/") ? (
            <video src={`/media/${value.attachment.filename}`} muted preload="metadata" className="h-full w-full object-cover" />
          ) : (
            <Image src={`/media/${value.attachment.filename}`} alt={value.attachment.originalName} fill sizes="64px" className="object-cover" />
          )}
        </div>
      ) : null}
    </div>
  );
}
