export type EnforcementAction = "none" | "municipal_guard" | "transport_inspector";

export const enforcementActionLabels: Record<EnforcementAction, string> = {
  none: "Não foi multado",
  municipal_guard: "Multado pela Guarda",
  transport_inspector: "Multado pelo Fiscal",
};

export function enforcementLabel(value: string | null | undefined) {
  if (!value) return enforcementActionLabels.none;
  return enforcementActionLabels[value as EnforcementAction] ?? value;
}

export function isFined(value: string | null | undefined) {
  return Boolean(value && value !== "none");
}
