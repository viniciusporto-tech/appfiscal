import {
  SHIFT_PERIOD_OPTIONS,
  type ShiftPeriod,
} from "@/lib/shifts/time";

// Uma linha da escala enviada pelo formulário.
export type ShiftAssignmentInput = {
  agentId: string;
  period: ShiftPeriod;
  notes: string;
};

// Dados usados ao criar um novo plantão.
export type CreateShiftInput = {
  serviceDate: string;
  teamId: string;
  notes: string;
  assignments: ShiftAssignmentInput[];
};

// Dados usados ao editar um plantão existente.
// Equipe e data não são alteradas; isso protege o histórico operacional.
export type UpdateShiftInput = {
  notes: string;
  assignments: ShiftAssignmentInput[];
};

// Resultado padronizado da validação.
type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; message: string };

// Confirma se o texto representa uma data simples no formato YYYY-MM-DD.
function isValidDateText(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime());
}

// Normaliza e valida as linhas de agentes da escala.
function validateAssignments(rawValue: unknown): ValidationResult<ShiftAssignmentInput[]> {
  // A escala pode ser criada sem agentes e preenchida depois.
  if (rawValue === undefined || rawValue === null) {
    return { valid: true, data: [] };
  }

  // Qualquer outro formato diferente de lista é recusado.
  if (!Array.isArray(rawValue)) {
    return { valid: false, message: "A lista de agentes da escala é inválida." };
  }

  const validPeriods = new Set(
    SHIFT_PERIOD_OPTIONS.map((option) => option.value),
  );

  const assignments: ShiftAssignmentInput[] = [];
  const usedAgents = new Set<string>();

  for (const rawItem of rawValue) {
    if (!rawItem || typeof rawItem !== "object") {
      return { valid: false, message: "Existe uma linha inválida na escala." };
    }

    const item = rawItem as Record<string, unknown>;
    const agentId = String(item.agentId ?? "").trim();
    const period = String(item.period ?? "") as ShiftPeriod;
    const notes = String(item.notes ?? "").trim();

    if (!agentId) {
      return { valid: false, message: "Selecione o agente em todas as linhas." };
    }

    if (!validPeriods.has(period)) {
      return { valid: false, message: "Selecione um período de trabalho válido." };
    }

    // No mesmo plantão o agente deve aparecer uma única vez.
    // Para 24h use o período 07h–07h em vez de duas linhas de 12h.
    if (usedAgents.has(agentId)) {
      return {
        valid: false,
        message: "O mesmo agente não pode aparecer duas vezes no mesmo plantão.",
      };
    }

    usedAgents.add(agentId);
    assignments.push({ agentId, period, notes });
  }

  return { valid: true, data: assignments };
}

// Valida o corpo de criação do plantão.
export function validateCreateShiftInput(
  rawValue: unknown,
): ValidationResult<CreateShiftInput> {
  if (!rawValue || typeof rawValue !== "object") {
    return { valid: false, message: "Dados do plantão inválidos." };
  }

  const value = rawValue as Record<string, unknown>;
  const serviceDate = String(value.serviceDate ?? "").trim();
  const teamId = String(value.teamId ?? "").trim();
  const notes = String(value.notes ?? "").trim();
  const assignmentsValidation = validateAssignments(value.assignments);

  if (!isValidDateText(serviceDate)) {
    return { valid: false, message: "Informe uma data válida para o plantão." };
  }

  if (!teamId) {
    return { valid: false, message: "Selecione a equipe responsável pelo plantão." };
  }

  if (!assignmentsValidation.valid) {
    return assignmentsValidation;
  }

  return {
    valid: true,
    data: {
      serviceDate,
      teamId,
      notes,
      assignments: assignmentsValidation.data,
    },
  };
}

// Valida o corpo de edição do plantão.
export function validateUpdateShiftInput(
  rawValue: unknown,
): ValidationResult<UpdateShiftInput> {
  if (!rawValue || typeof rawValue !== "object") {
    return { valid: false, message: "Dados da escala inválidos." };
  }

  const value = rawValue as Record<string, unknown>;
  const notes = String(value.notes ?? "").trim();
  const assignmentsValidation = validateAssignments(value.assignments);

  if (!assignmentsValidation.valid) {
    return assignmentsValidation;
  }

  return {
    valid: true,
    data: {
      notes,
      assignments: assignmentsValidation.data,
    },
  };
}
