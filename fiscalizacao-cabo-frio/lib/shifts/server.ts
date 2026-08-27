import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAssignmentInterval,
  SHIFT_PERIOD_OPTIONS,
  type ShiftPeriod,
} from "@/lib/shifts/time";
import type { ShiftAssignmentInput } from "@/lib/shifts/validation";

// Informações mínimas do agente necessárias para validar uma escala.
type AgentRecord = {
  id: string;
  full_name: string;
  work_hours: number | null;
  status: "active" | "inactive";
};

// Resultado do preparo das linhas antes do insert no banco.
export type PreparedAssignment = {
  agent_id: string;
  team_id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  status: "scheduled";
};

// Erro operacional que pode ser mostrado ao administrador sem expor detalhes internos.
export class ShiftValidationError extends Error {}

// Descobre quantas horas correspondem ao período escolhido.
function getPeriodHours(period: ShiftPeriod): 12 | 24 {
  const option = SHIFT_PERIOD_OPTIONS.find((item) => item.value === period);
  return option?.hours ?? 12;
}

// Valida agentes, equipe permitida, jornada e conflitos com outras escalas.
export async function prepareAssignments(params: {
  teamId: string;
  serviceDate: string;
  assignments: ShiftAssignmentInput[];
  ignoreShiftId?: string;
}): Promise<PreparedAssignment[]> {
  const { teamId, serviceDate, assignments, ignoreShiftId } = params;

  // Não há nada para validar quando o plantão ainda não possui agentes.
  if (assignments.length === 0) {
    return [];
  }

  const adminSupabase = createAdminClient();
  const agentIds = assignments.map((assignment) => assignment.agentId);

  // Carrega os agentes escolhidos de uma única vez.
  const { data: agents, error: agentsError } = await adminSupabase
    .from("profiles")
    .select("id, full_name, work_hours, status, role")
    .in("id", agentIds)
    .eq("role", "agent");

  if (agentsError) {
    throw new ShiftValidationError(agentsError.message);
  }

  // Todos os IDs enviados precisam corresponder a agentes reais.
  if ((agents?.length ?? 0) !== agentIds.length) {
    throw new ShiftValidationError("Um dos agentes selecionados não existe.");
  }

  const agentById = new Map(
    ((agents ?? []) as AgentRecord[]).map((agent) => [agent.id, agent]),
  );

  // Confirma que todos os agentes podem atuar na equipe escolhida.
  const { data: links, error: linksError } = await adminSupabase
    .from("agent_teams")
    .select("agent_id")
    .eq("team_id", teamId)
    .in("agent_id", agentIds);

  if (linksError) {
    throw new ShiftValidationError(linksError.message);
  }

  const allowedAgentIds = new Set((links ?? []).map((link) => link.agent_id));

  // Monta os intervalos reais de cada agente e executa validações individuais.
  const prepared: PreparedAssignment[] = assignments.map((assignment) => {
    const agent = agentById.get(assignment.agentId);

    if (!agent) {
      throw new ShiftValidationError("Agente não encontrado.");
    }

    if (agent.status !== "active") {
      throw new ShiftValidationError(
        `${agent.full_name} está inativo e não pode entrar na escala.`,
      );
    }

    if (!allowedAgentIds.has(agent.id)) {
      throw new ShiftValidationError(
        `${agent.full_name} não está vinculado à equipe selecionada.`,
      );
    }

    const periodHours = getPeriodHours(assignment.period);

    // A jornada cadastrada serve como trava contra erro de escala.
    // Mudanças excepcionais devem ser ajustadas primeiro no cadastro do agente.
    if (agent.work_hours && agent.work_hours !== periodHours) {
      throw new ShiftValidationError(
        `${agent.full_name} está cadastrado com jornada de ${agent.work_hours}h e não pode receber um período de ${periodHours}h.`,
      );
    }

    const interval = getAssignmentInterval(serviceDate, assignment.period);

    return {
      agent_id: assignment.agentId,
      team_id: teamId,
      starts_at: interval.startsAt,
      ends_at: interval.endsAt,
      notes: assignment.notes || null,
      status: "scheduled",
    };
  });

  // Define a janela geral de busca: 07h do dia até 07h do dia seguinte.
  const overallStart = prepared.reduce(
    (lowest, item) =>
      new Date(item.starts_at).getTime() < new Date(lowest).getTime()
        ? item.starts_at
        : lowest,
    prepared[0].starts_at,
  );
  const overallEnd = prepared.reduce(
    (highest, item) =>
      new Date(item.ends_at).getTime() > new Date(highest).getTime()
        ? item.ends_at
        : highest,
    prepared[0].ends_at,
  );

  // Busca qualquer escala ativa dos agentes que cruze a janela operacional.
  let conflictsQuery = adminSupabase
    .from("shift_agents")
    .select("id, shift_id, agent_id, team_id, starts_at, ends_at")
    .eq("status", "scheduled")
    .in("agent_id", agentIds)
    .lt("starts_at", overallEnd)
    .gt("ends_at", overallStart);

  // Na edição, os vínculos atuais daquele mesmo plantão são substituídos e não contam como conflito.
  if (ignoreShiftId) {
    conflictsQuery = conflictsQuery.neq("shift_id", ignoreShiftId);
  }

  const { data: conflicts, error: conflictsError } = await conflictsQuery;

  if (conflictsError) {
    throw new ShiftValidationError(conflictsError.message);
  }

  // Compara cada período novo com as escalas encontradas para apontar o agente correto.
  for (const item of prepared) {
    const conflict = (conflicts ?? []).find(
      (existing) =>
        existing.agent_id === item.agent_id &&
        new Date(existing.starts_at).getTime() < new Date(item.ends_at).getTime() &&
        new Date(existing.ends_at).getTime() > new Date(item.starts_at).getTime(),
    );

    if (conflict) {
      const agent = agentById.get(item.agent_id);
      throw new ShiftValidationError(
        `${agent?.full_name ?? "O agente"} já possui outra escala que conflita com este horário.`,
      );
    }
  }

  return prepared;
}
