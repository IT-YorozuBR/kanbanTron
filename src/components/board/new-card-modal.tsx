"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCard, setChoiceFieldValue, setTextFieldValue, uploadFieldAttachment } from "@/lib/actions";
import { decodeOptions } from "@/lib/field-options";
import type { CardWithAttachments, FieldDefinitionData, FieldType, FieldValueData } from "@/lib/types";

export function NewCardModal({
  columnId,
  fieldDefinitions,
  onClose,
  onCreated,
}: {
  columnId: string;
  fieldDefinitions: FieldDefinitionData[];
  onClose: () => void;
  onCreated: (card: CardWithAttachments) => void;
}) {
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [choiceValues, setChoiceValues] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      const created = await createCard({ columnId });
      if (!created.ok) {
        setError(created.error);
        return;
      }
      const cardId = created.data.id;
      const fieldValues: FieldValueData[] = [];

      const textEntries = Object.entries(textValues).filter(([, value]) => value.trim().length > 0);
      const choiceEntries = Object.entries(choiceValues).filter(([, selected]) => selected.length > 0);
      const fileEntries = Object.entries(files).filter(([, list]) => list.length > 0);

      await Promise.all([
        ...textEntries.map(async ([fieldDefinitionId, value]) => {
          const field = fieldDefinitions.find((f) => f.id === fieldDefinitionId);
          if (!field) return;
          const res = await setTextFieldValue({ cardId, fieldDefinitionId, value });
          if (res.ok) {
            fieldValues.push({
              id: `optimistic-${fieldDefinitionId}`,
              cardId,
              fieldDefinitionId,
              fieldDefinition: field,
              textValue: value,
              choiceValue: null,
              attachments: [],
              updatedAt: new Date(),
            });
          }
        }),
        ...choiceEntries.map(async ([fieldDefinitionId, selected]) => {
          const field = fieldDefinitions.find((f) => f.id === fieldDefinitionId);
          if (!field) return;
          const res = await setChoiceFieldValue({ cardId, fieldDefinitionId, selected });
          if (res.ok) {
            fieldValues.push({
              id: `optimistic-${fieldDefinitionId}`,
              cardId,
              fieldDefinitionId,
              fieldDefinition: field,
              textValue: null,
              choiceValue: JSON.stringify(selected),
              attachments: [],
              updatedAt: new Date(),
            });
          }
        }),
        ...fileEntries.map(async ([fieldDefinitionId, fileList]) => {
          const field = fieldDefinitions.find((f) => f.id === fieldDefinitionId);
          if (!field) return;
          const attachments = [];
          for (const file of fileList) {
            const formData = new FormData();
            formData.set("cardId", cardId);
            formData.set("fieldDefinitionId", fieldDefinitionId);
            formData.set("file", file);
            const res = await uploadFieldAttachment(formData);
            if (res.ok) {
              attachments.push({
                id: res.data.id,
                filename: res.data.filename,
                originalName: file.name,
                mimeType: file.type.startsWith("video/") ? file.type : "image/webp",
                size: 0,
                width: null,
                height: null,
                cardId,
                fieldValueId: null,
                createdAt: new Date(),
              });
            }
          }
          if (attachments.length > 0) {
            fieldValues.push({
              id: `optimistic-${fieldDefinitionId}`,
              cardId,
              fieldDefinitionId,
              fieldDefinition: field,
              textValue: null,
              choiceValue: null,
              attachments,
              updatedAt: new Date(),
            });
          }
        }),
      ]);

      const titleField = fieldDefinitions.find((f) => f.isTitleField);
      const titleOverride = titleField ? textValues[titleField.id]?.trim() : undefined;

      onCreated({
        id: cardId,
        title: titleOverride || created.data.title,
        order: 0,
        columnId,
        attachments: [],
        fieldValues,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      router.refresh();
      onClose();
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
          <h2 className="text-base font-bold">Novo card</h2>
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

        {fieldDefinitions.length > 0 ? (
          <div className="mb-4 flex flex-col gap-4">
            {fieldDefinitions.map((field) => (
              <NewCardFieldInput
                key={field.id}
                field={field}
                textValue={textValues[field.id] ?? ""}
                onTextChange={(value) => setTextValues((prev) => ({ ...prev, [field.id]: value }))}
                selected={choiceValues[field.id] ?? []}
                onChoiceChange={(selected) => setChoiceValues((prev) => ({ ...prev, [field.id]: selected }))}
                fileList={files[field.id] ?? []}
                onFilesChange={(fileList) => setFiles((prev) => ({ ...prev, [field.id]: fileList }))}
              />
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-black/50 dark:text-white/50">
            Nenhum campo cadastrado nesta fase. O card sera criado sem dados adicionais.
          </p>
        )}

        {error ? <p className="mb-4 text-xs font-medium text-rose-600">{error}</p> : null}

        <div className="flex gap-2">
          <button type="button" onClick={handleSubmit} disabled={pending} className="aero-button flex-1">
            {pending ? "Criando..." : "Criar card"}
          </button>
          <button type="button" onClick={onClose} className="aero-button aero-button-ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function NewCardFieldInput({
  field,
  textValue,
  onTextChange,
  selected,
  onChoiceChange,
  fileList,
  onFilesChange,
}: {
  field: FieldDefinitionData;
  textValue: string;
  onTextChange: (value: string) => void;
  selected: string[];
  onChoiceChange: (selected: string[]) => void;
  fileList: File[];
  onFilesChange: (fileList: File[]) => void;
}) {
  const type = field.type as FieldType;
  const options = decodeOptions(field.options);

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
          onChange={(e) => onTextChange(e.target.value)}
        />
      ) : null}

      {type === "long_text" ? (
        <textarea
          className="aero-input resize-none"
          rows={3}
          value={textValue}
          maxLength={2000}
          onChange={(e) => onTextChange(e.target.value)}
        />
      ) : null}

      {type === "single_choice" ? (
        <div className="flex flex-wrap gap-3">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={`new-card-field-${field.id}`}
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
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="aero-input text-xs"
            onChange={(e) => {
              const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
              if (selectedFiles.length > 0) onFilesChange([...fileList, ...selectedFiles]);
              e.target.value = "";
            }}
          />
          {fileList.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-0.5">
              {fileList.map((file, index) => (
                <li key={`${file.name}-${index}`} className="text-xs text-black/50 dark:text-white/50">
                  {file.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
