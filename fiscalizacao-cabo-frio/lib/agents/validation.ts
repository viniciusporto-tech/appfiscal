// Dados aceitos ao criar ou editar um agente no painel administrativo.
export type AgentInput = {
  fullName: string;
  registrationNumber: string;
  email: string;
  password?: string;
  workHours: 12 | 24;
  status: "active" | "inactive";
  teamIds: string[];
};

// Resultado padronizado da validação.
export type ValidationResult =
  | { valid: true; data: AgentInput }
  | { valid: false; message: string };

// Valida e normaliza os dados recebidos do navegador antes de chegar ao Supabase.
export function validateAgentInput(
  rawValue: unknown,
  options: { passwordRequired: boolean },
): ValidationResult {
  // Garante que o corpo recebido seja um objeto comum.
  if (!rawValue || typeof rawValue !== "object") {
    return { valid: false, message: "Dados do agente inválidos." };
  }

  // Converte para um objeto indexável sem assumir que os campos já são válidos.
  const value = rawValue as Record<string, unknown>;

  // Normaliza nome, matrícula e e-mail removendo espaços desnecessários.
  const fullName = String(value.fullName ?? "").trim();
  const registrationNumber = String(value.registrationNumber ?? "").trim();
  const email = String(value.email ?? "").trim().toLowerCase();
  const password = String(value.password ?? "");

  // Converte a jornada recebida para número.
  const workHours = Number(value.workHours);

  // Lê o status, usando "active" como padrão seguro para novos cadastros.
  const status = value.status === "inactive" ? "inactive" : "active";

  // Mantém somente IDs de equipe em formato de texto não vazio.
  const teamIds = Array.isArray(value.teamIds)
    ? value.teamIds
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

  // Nome completo é obrigatório e evita cadastros difíceis de identificar.
  if (fullName.length < 3) {
    return { valid: false, message: "Informe o nome completo do agente." };
  }

  // Matrícula é obrigatória porque será usada para identificação interna.
  if (!registrationNumber) {
    return { valid: false, message: "Informe a matrícula do agente." };
  }

  // Validação simples de e-mail suficiente para bloquear entradas claramente inválidas.
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { valid: false, message: "Informe um e-mail válido." };
  }

  // Somente as jornadas previstas pelo projeto são aceitas.
  if (workHours !== 12 && workHours !== 24) {
    return { valid: false, message: "A jornada deve ser de 12 ou 24 horas." };
  }

  // No cadastro inicial, uma senha temporária é obrigatória.
  if (options.passwordRequired && password.length < 8) {
    return {
      valid: false,
      message: "A senha temporária deve ter pelo menos 8 caracteres.",
    };
  }

  // Na edição, senha vazia significa "não alterar"; quando preenchida, precisa ter 8 caracteres.
  if (!options.passwordRequired && password && password.length < 8) {
    return {
      valid: false,
      message: "A nova senha deve ter pelo menos 8 caracteres.",
    };
  }

  // Remove equipes repetidas para evitar inserts duplicados em agent_teams.
  const uniqueTeamIds = Array.from(new Set(teamIds));

  // Retorna os dados já normalizados e tipados.
  return {
    valid: true,
    data: {
      fullName,
      registrationNumber,
      email,
      password: password || undefined,
      workHours: workHours as 12 | 24,
      status,
      teamIds: uniqueTeamIds,
    },
  };
}
