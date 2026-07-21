"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  createFieldDefinition,
  deleteFieldDefinition,
  reorderFieldDefinitions,
  updateFieldDefinition,
} from "@/lib/actions";
import type { FieldDefinitionData, FieldType } from "@/lib/types";
import { decodeOptions } from "@/lib/field-options";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  attachment: "Anexo",
  single_choice: "Escolha unica",
  multi_choice: "Multipla escolha",
};

const FIELD_TYPE_OPTIONS: FieldType[] = ["short_text", "long_text", "attachment", "single_choice", "multi_choice"];

export function FieldsManagerModal({
  columnId,
  columnTitle,
  fieldDefinitions,
  onFieldDefinitionsChange,
  onClose,
}: {
  columnId: string;
  columnTitle: string;
  fieldDefinitions: FieldDefinitionData[];
  onFieldDefinitionsChange: Dispatch<SetStateAction<FieldDefinitionData[]>>;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("short_text");
  const [newOptions, setNewOptions] = useState("");
  const [newIsTitleField, setNewIsTitleField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isChoiceType = newType === "single_choice" || newType === "multi_choice";
  const isTextType = newType === "short_text" || newType === "long_text";

  function handleCreate() {
    const label = newLabel.trim();
    if (!label) return;
    const options = newOptions
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const isTitleField = isTextType && newIsTitleField;

    setError(null);
    startTransition(async () => {
      const res = await createFieldDefinition({
        columnId,
        label,
        type: newType,
        options: isChoiceType ? options : undefined,
        isTitleField,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onFieldDefinitionsChange((prev) => [
        ...prev.map((f) => (isTitleField ? { ...f, isTitleField: false } : f)),
        {
          id: res.data.id,
          columnId,
          label,
          type: newType,
          options: isChoiceType ? JSON.stringify(options) : null,
          isTitleField,
          order: prev.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      setNewLabel("");
      setNewOptions("");
      setNewType("short_text");
      setNewIsTitleField(false);
      setAdding(false);
      router.refresh();
    });
  }

  function handleRename(field: FieldDefinitionData, label: string) {
    const trimmed = label.trim();
    if (!trimmed || trimmed === field.label) return;
    onFieldDefinitionsChange((prev) => prev.map((f) => (f.id === field.id ? { ...f, label: trimmed } : f)));
    startTransition(async () => {
      const res = await updateFieldDefinition({ fieldDefinitionId: field.id, label: trimmed });
      if (!res.ok) router.refresh();
    });
  }

  function handleOptionsChange(field: FieldDefinitionData, raw: string) {
    const options = raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    onFieldDefinitionsChange((prev) =>
      prev.map((f) => (f.id === field.id ? { ...f, options: JSON.stringify(options) } : f)),
    );
    startTransition(async () => {
      const res = await updateFieldDefinition({ fieldDefinitionId: field.id, options });
      if (!res.ok) router.refresh();
    });
  }

  function handleTitleFieldToggle(field: FieldDefinitionData, checked: boolean) {
    onFieldDefinitionsChange((prev) =>
      prev.map((f) => {
        if (f.id === field.id) return { ...f, isTitleField: checked };
        return checked ? { ...f, isTitleField: false } : f;
      }),
    );
    startTransition(async () => {
      const res = await updateFieldDefinition({ fieldDefinitionId: field.id, isTitleField: checked });
      if (!res.ok) router.refresh();
    });
  }

  function handleDelete(field: FieldDefinitionData) {
    if (!confirm(`Excluir o campo "${field.label}" de todos os cards?`)) return;
    onFieldDefinitionsChange((prev) => prev.filter((f) => f.id !== field.id));
    startTransition(async () => {
      const res = await deleteFieldDefinition({ fieldDefinitionId: field.id });
      if (!res.ok) router.refresh();
    });
  }

  function handleMove(field: FieldDefinitionData, direction: -1 | 1) {
    const index = fieldDefinitions.findIndex((f) => f.id === field.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fieldDefinitions.length) return;

    const reordered = [...fieldDefinitions];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onFieldDefinitionsChange(reordered);
    startTransition(async () => {
      const res = await reorderFieldDefinitions({
        columnId,
        orderedFieldDefinitionIds: reordered.map((f) => f.id),
      });
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Campos da fase &ldquo;{columnTitle}&rdquo;</h2>
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

        <div className="mb-4 flex flex-col gap-3">
          {fieldDefinitions.map((field, index) => (
            <div key={field.id} className="aero-card flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(field, -1)}
                    aria-label="Mover para cima"
                    className="text-black/40 disabled:opacity-20 dark:text-white/40"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 7.5L6 3.5L10 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={index === fieldDefinitions.length - 1}
                    onClick={() => handleMove(field, 1)}
                    aria-label="Mover para baixo"
                    className="text-black/40 disabled:opacity-20 dark:text-white/40"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <input
                  className="aero-input flex-1 text-sm font-semibold"
                  defaultValue={field.label}
                  maxLength={60}
                  onBlur={(e) => handleRename(field, e.target.value)}
                />
                <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[11px] font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
                  {FIELD_TYPE_LABELS[field.type as FieldType]}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(field)}
                  disabled={pending}
                  aria-label="Excluir campo"
                  className="shrink-0 rounded-full p-1.5 text-black/40 hover:bg-black/10 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {(field.type === "single_choice" || field.type === "multi_choice") && (
                <input
                  className="aero-input text-xs"
                  placeholder="Opcoes separadas por virgula"
                  defaultValue={decodeOptions(field.options).join(", ")}
                  onBlur={(e) => handleOptionsChange(field, e.target.value)}
                />
              )}
              {(field.type === "short_text" || field.type === "long_text") && (
                <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
                  <input
                    type="checkbox"
                    checked={field.isTitleField}
                    onChange={(e) => handleTitleFieldToggle(field, e.target.checked)}
                  />
                  Usar como titulo do card
                </label>
              )}
            </div>
          ))}
          {fieldDefinitions.length === 0 && !adding ? (
            <p className="text-sm text-black/50 dark:text-white/50">Nenhum campo criado ainda.</p>
          ) : null}
        </div>

        {adding ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              className="aero-input"
              placeholder="Nome do campo"
              value={newLabel}
              maxLength={60}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <select
              className="aero-input"
              value={newType}
              onChange={(e) => setNewType(e.target.value as FieldType)}
            >
              {FIELD_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {isChoiceType ? (
              <input
                className="aero-input"
                placeholder="Opcoes separadas por virgula"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
              />
            ) : null}
            {isTextType ? (
              <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
                <input
                  type="checkbox"
                  checked={newIsTitleField}
                  onChange={(e) => setNewIsTitleField(e.target.checked)}
                />
                Usar como titulo do card
              </label>
            ) : null}
            {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={handleCreate} disabled={pending} className="aero-button flex-1">
                Adicionar campo
              </button>
              <button type="button" onClick={() => setAdding(false)} className="aero-button aero-button-ghost">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="aero-button aero-button-lime w-full justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Novo campo
          </button>
        )}
      </div>
    </div>
  );
}
