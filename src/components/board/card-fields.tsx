"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { deleteFieldAttachment, setChoiceFieldValue, setTextFieldValue, uploadFieldAttachment } from "@/lib/actions";
import { decodeOptions } from "@/lib/field-options";
import type { CardWithAttachments, FieldDefinitionData, FieldType, FieldValueData } from "@/lib/types";

function upsertValue(
  values: FieldValueData[],
  fieldDefinition: FieldDefinitionData,
  patch: Partial<FieldValueData>,
) {
  const existing = values.find((v) => v.fieldDefinitionId === fieldDefinition.id);
  if (existing) {
    return values.map((v) => (v.fieldDefinitionId === fieldDefinition.id ? { ...v, ...patch } : v));
  }
  return [
    ...values,
    {
      id: `optimistic-${fieldDefinition.id}`,
      cardId: "",
      fieldDefinitionId: fieldDefinition.id,
      fieldDefinition,
      textValue: null,
      choiceValue: null,
      attachmentId: null,
      attachment: null,
      updatedAt: new Date(),
      ...patch,
    } as FieldValueData,
  ];
}

export function CardFields({
  card,
  fieldDefinitions,
  patchCard,
}: {
  card: CardWithAttachments;
  fieldDefinitions: FieldDefinitionData[];
  patchCard: (patch: Partial<CardWithAttachments>) => void;
}) {
  const router = useRouter();

  if (fieldDefinitions.length === 0) return null;

  function valueFor(fieldDefinitionId: string) {
    return card.fieldValues.find((v) => v.fieldDefinitionId === fieldDefinitionId);
  }

  function handleTextChange(field: FieldDefinitionData, value: string) {
    patchCard({ fieldValues: upsertValue(card.fieldValues, field, { textValue: value }) });
    setTextFieldValue({ cardId: card.id, fieldDefinitionId: field.id, value }).then((res) => {
      if (!res.ok) router.refresh();
    });
  }

  function handleChoiceChange(field: FieldDefinitionData, selected: string[]) {
    patchCard({
      fieldValues: upsertValue(card.fieldValues, field, { choiceValue: JSON.stringify(selected) }),
    });
    setChoiceFieldValue({ cardId: card.id, fieldDefinitionId: field.id, selected }).then((res) => {
      if (!res.ok) router.refresh();
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-4">
      {fieldDefinitions.map((field) => (
        <FieldInput
          key={field.id}
          card={card}
          field={field}
          value={valueFor(field.id)}
          onTextChange={(value) => handleTextChange(field, value)}
          onChoiceChange={(selected) => handleChoiceChange(field, selected)}
          patchCard={patchCard}
        />
      ))}
    </div>
  );
}

function FieldInput({
  card,
  field,
  value,
  onTextChange,
  onChoiceChange,
  patchCard,
}: {
  card: CardWithAttachments;
  field: FieldDefinitionData;
  value: FieldValueData | undefined;
  onTextChange: (value: string) => void;
  onChoiceChange: (selected: string[]) => void;
  patchCard: (patch: Partial<CardWithAttachments>) => void;
}) {
  const type = field.type as FieldType;
  const options = decodeOptions(field.options);
  const selected = decodeOptions(value?.choiceValue);
  const [textValue, setTextValue] = useState(value?.textValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.set("cardId", card.id);
    formData.set("fieldDefinitionId", field.id);
    formData.set("file", file);

    const res = await uploadFieldAttachment(formData);
    setUploading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    patchCard({
      fieldValues: upsertValue(card.fieldValues, field, {
        attachmentId: res.data.id,
        attachment: {
          id: res.data.id,
          filename: res.data.filename,
          originalName: file.name,
          mimeType: file.type.startsWith("video/") ? file.type : "image/webp",
          size: 0,
          width: null,
          height: null,
          cardId: card.id,
          createdAt: new Date(),
        },
      }),
    });
    router.refresh();
  }

  function handleRemoveAttachment() {
    patchCard({
      fieldValues: upsertValue(card.fieldValues, field, { attachmentId: null, attachment: null }),
    });
    deleteFieldAttachment({ cardId: card.id, fieldDefinitionId: field.id }).then((res) => {
      if (!res.ok) router.refresh();
    });
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {field.label}
      </label>

      {type === "short_text" ? (
        <input
          className="aero-input"
          value={textValue}
          maxLength={2000}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={() => onTextChange(textValue)}
        />
      ) : null}

      {type === "long_text" ? (
        <textarea
          className="aero-input resize-none"
          rows={3}
          value={textValue}
          maxLength={2000}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={() => onTextChange(textValue)}
        />
      ) : null}

      {type === "single_choice" ? (
        <div className="flex flex-wrap gap-3">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={`field-${field.id}`}
                checked={selected[0] === option}
                onChange={() => onChoiceChange([option])}
              />
              {option}
            </label>
          ))}
        </div>
      ) : null}

      {type === "multi_choice" ? (
        <div className="flex flex-wrap gap-3">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) =>
                  onChoiceChange(e.target.checked ? [...selected, option] : selected.filter((o) => o !== option))
                }
              />
              {option}
            </label>
          ))}
        </div>
      ) : null}

      {type === "attachment" ? (
        <div>
          {value?.attachment ? (
            <div className="group relative mb-2 h-28 w-28 overflow-hidden rounded-lg border border-white/50">
              {value.attachment.mimeType.startsWith("video/") ? (
                <video src={`/media/${value.attachment.filename}`} muted preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <Image
                  src={`/media/${value.attachment.filename}`}
                  alt={value.attachment.originalName}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              )}
              <button
                type="button"
                onClick={handleRemoveAttachment}
                aria-label="Remover anexo"
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : null}
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
            className="aero-button aero-button-ghost text-xs"
          >
            {uploading ? "Enviando..." : value?.attachment ? "Substituir arquivo" : "Anexar arquivo"}
          </button>
          {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
