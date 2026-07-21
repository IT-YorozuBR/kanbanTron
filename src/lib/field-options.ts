// FieldDefinition.options and FieldValue.choiceValue are stored as
// JSON-encoded string[] in a single TEXT column (SQLite has no array type).

export function encodeOptions(options: string[]): string {
  return JSON.stringify(options);
}

export function decodeOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
