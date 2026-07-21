"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { deleteFieldAttachment, setChoiceFieldValue, setTextFieldValue, uploadFieldAttachment } from "@/lib/actions";
import { decodeOptions } from "@/lib/field-options";
import type { AttachmentData, CardWithAttachments, FieldDefinitionData, FieldType, FieldValueData } from "@/lib/types";

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
      attachments: [],
      updatedAt: new Date(),
      ...patch,
    } as FieldValueData,
  ];
}

export function CardFields({
  card,
  fieldDefinitions,
  patchCard,
  onOpenAttachment,
}: {
  card: CardWithAttachments;
  fieldDefinitions: FieldDefinitionData[];
  patchCard: (patch: Partial<CardWithAttachments>) => void;
  onOpenAttachment: (attachment: AttachmentData) => void;
}) {
  const router = useRouter();

  if (fieldDefinitions.length === 0) return null;

  function valueFor(fieldDefinitionId: string) {
    return card.fieldValues.find((v) => v.fieldDefinitionId === fieldDefinitionId);
  }

  function handleTextChange(field: FieldDefinitionData, value: string) {
    patchCard({ fieldValues: upsertValue(card.fieldValues, field, { textValue: value }) });
    setTextFieldValue({ cardId: card.id, fieldDefinitionId: field.id, value }).then((res) => {
      if (!res.ok) {
        router.refresh();
        return;
      }
      if (res.data.title) patchCard({ title: res.data.title });
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
          onOpenAttachment={onOpenAttachment}
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
  onOpenAttachment,
}: {
  card: CardWithAttachments;
  field: FieldDefinitionData;
  value: FieldValueData | undefined;
  onTextChange: (value: string) => void;
  onChoiceChange: (selected: string[]) => void;
  patchCard: (patch: Partial<CardWithAttachments>) => void;
  onOpenAttachment: (attachment: AttachmentData) => void;
}) {
  const type = field.type as FieldType;
  const options = decodeOptions(field.options);
  const selected = decodeOptions(value?.choiceValue);
  const [textValue, setTextValue] = useState(value?.textValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const attachments = value?.attachments ?? [];

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    let current = attachments;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.set("cardId", card.id);
      formData.set("fieldDefinitionId", field.id);
      formData.set("file", file);

      const res = await uploadFieldAttachment(formData);
      if (!res.ok) {
        setError(res.error);
        continue;
      }

      const newAttachment: AttachmentData = {
        id: res.data.id,
        filename: res.data.filename,
        originalName: file.name,
        mimeType: file.type.startsWith("video/") ? file.type : "image/webp",
        size: 0,
        width: null,
        height: null,
        cardId: card.id,
        fieldValueId: null,
        createdAt: new Date(),
      };
      current = [...current, newAttachment];
      patchCard({ fieldValues: upsertValue(card.fieldValues, field, { attachments: current }) });
    }

    setUploading(false);
    router.refresh();
  }

  function handleRemoveAttachment(attachmentId: string) {
    patchCard({
      fieldValues: upsertValue(card.fieldValues, field, {
        attachments: attachments.filter((a) => a.id !== attachmentId),
      }),
    });
    deleteFieldAttachment({ attachmentId }).then((res) => {
      if (!res.ok) router.refresh();
    });
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {field.label}
        {field.isTitleField ? (
          <span className="ml-1 normal-case text-black/40 dark:text-white/40">(titulo do card)</span>
        ) : null}
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
          {attachments.length > 0 ? (
            <div className="mb-2 grid grid-cols-3 gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  onClick={() => onOpenAttachment(attachment)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-white/50"
                >
                  {attachment.mimeType.startsWith("video/") ? (
                    <>
                      <video
                        src={`/media/${attachment.filename}`}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                        <svg width="22" height="22" viewBox="0 0 16 16" fill="white" aria-hidden="true">
                          <path d="M4 2.5v11l10-5.5-10-5.5Z" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <Image
                      src={`/media/${attachment.filename}`}
                      alt={attachment.originalName}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAttachment(attachment.id);
                    }}
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
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aero-button aero-button-ghost text-xs"
          >
            {uploading ? "Enviando..." : "Anexar arquivo"}
          </button>
          {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
