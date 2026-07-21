export type AccentId = "blue" | "lime" | "tangerine" | "grape" | "berry";

export const ACCENT_OPTIONS: { id: AccentId; label: string; buttonClass: string }[] = [
  { id: "blue", label: "Azul", buttonClass: "aero-button" },
  { id: "lime", label: "Lima", buttonClass: "aero-button aero-button-lime" },
  { id: "tangerine", label: "Tangerina", buttonClass: "aero-button aero-button-tangerine" },
  { id: "grape", label: "Uva", buttonClass: "aero-button aero-button-grape" },
  { id: "berry", label: "Framboesa", buttonClass: "aero-button aero-button-berry" },
];

export const DEFAULT_ACCENT: AccentId = "blue";

export function isAccentId(value: string): value is AccentId {
  return ACCENT_OPTIONS.some((option) => option.id === value);
}

export function accentButtonClass(accent: string): string {
  return ACCENT_OPTIONS.find((option) => option.id === accent)?.buttonClass ?? "aero-button";
}

// Solid swatch color for the given accent, used for small color dots/badges.
export function accentSwatchVar(accent: string): string {
  const id = isAccentId(accent) ? accent : DEFAULT_ACCENT;
  return `var(--aero-${id})`;
}
