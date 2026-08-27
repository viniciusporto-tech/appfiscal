import Link from "next/link";
import { notFound } from "next/navigation";
import { ShiftCancelButton } from "@/components/admin/ShiftCancelButton";
import { ShiftForm } from "@/components/admin/ShiftForm";
import {
  inferShiftPeriod,
  OPERATION_TIME_ZONE,
} from "@/lib/shifts/time";
import { createClient } from "@/lib/supabase/server";

// Parâmetro dinâmico recebido em /admin/escalas/:id.
type EditShiftPageProps = {
  params: Promise<{ id: string }>;
};

// Converte o início do plantão para YYYY-MM-DD no horário de Cabo Frio.
function getServiceDate(startsAt: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startsAt));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Tela para consultar e alterar a composição atual de um plantão.
export default async function EditShiftPage({ params }: EditShiftPageProps) {
  const { id: shiftId } = await params;
  const supabase = await createClient();

  // Carrega o cabeçalho do plantão.
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id, team_id, starts_at, ends_at, notes, status")
    .eq("id", shiftId)
    .single();

  if (shiftError || !shift) {
    notFound();
  }

  // Carrega o nome da equipe para exibir na tela.
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", shift.team_id)
    .single();

  if (teamError || !team) {
    throw new Error(teamError?.message ?? "Equipe do plantão não encontrada.");
  }

  // Somente os vínculos atualmente válidos entram no formulário de edição.
  const { data: currentAssignments, error: assignmentsError } = await supabase
    .from("shift_agents")
    .select("agent_id, starts_at, ends_at, notes")
    .eq("shift_id", shiftId)
    .eq("status", "scheduled")
    .order("starts_at");

  // Carrega os agentes ativos que podem ser selecionados atualmente.
  const { data: agents, error: agentsError } = await supabase
    .from("profiles")
    .select("id, full_name, registration_number, work_hours")
    .eq("role", "agent")
    .eq("status", "active")
    .order("full_name");

  // Carrega todos os vínculos administrativos agente/equipe.
  const { data: agentTeams, error: linksError } = await supabase
    .from("agent_teams")
    .select("agent_id, team_id");

  if (assignmentsError || agentsError || linksError) {
    throw new Error(
      assignmentsError?.message ??
        agentsError?.message ??
        linksError?.message ??
        "Não foi possível carregar a escala.",
    );
  }

  const teamIdsByAgent = new Map<string, string[]>();

  for (const link of agentTeams ?? []) {
    const current = teamIdsByAgent.get(link.agent_id) ?? [];
    current.push(link.team_id);
    teamIdsByAgent.set(link.agent_id, current);
  }

  const agentOptions = (agents ?? []).map((agent) => ({
    id: agent.id,
    fullName: agent.full_name,
    registrationNumber: agent.registration_number ?? "Sem matrícula",
    workHours: agent.work_hours === 24 ? (24 as const) : (12 as const),
    teamIds: teamIdsByAgent.get(agent.id) ?? [],
  }));

  // Converte timestamps em um dos três períodos padronizados do sistema.
  const formAssignments = (currentAssignments ?? []).map((assignment) => ({
    agentId: assignment.agent_id,
    period: inferShiftPeriod(assignment.starts_at, assignment.ends_at),
    notes: assignment.notes ?? "",
  }));

  return (
    <section className="admin-form-page shift-admin-page">
      <div className="topbar">
        <div>
          <div className="metric-label">Escalas / Plantões</div>
          <h1 style={{ margin: "4px 0" }}>Editar escala</h1>
          <p className="metric-label" style={{ margin: "6px 0 0" }}>
            {team.name} — plantão iniciado em {getServiceDate(shift.starts_at)}.
          </p>
        </div>

        <div className="topbar-actions">
          {shift.status !== "cancelled" && (
            <ShiftCancelButton shiftId={shift.id} />
          )}
          <Link className="button button-secondary" href="/admin/escalas">
            Voltar
          </Link>
        </div>
      </div>

      {shift.status === "cancelled" ? (
        <div className="card">
          <span className="status-badge status-cancelled">Cancelado</span>
          <h2>Este plantão está somente no histórico.</h2>
          <p className="metric-label">
            Plantões cancelados não podem ser editados. As fiscalizações e versões antigas da escala permanecem preservadas no banco.
          </p>
        </div>
      ) : (
        <ShiftForm
          teams={[team]}
          agents={agentOptions}
          defaultServiceDate={getServiceDate(shift.starts_at)}
          initialValues={{
            id: shift.id,
            serviceDate: getServiceDate(shift.starts_at),
            teamId: team.id,
            teamName: team.name,
            notes: shift.notes ?? "",
            assignments: formAssignments,
          }}
        />
      )}
    </section>
  );
}
