import Link from "next/link";
import { ShiftForm } from "@/components/admin/ShiftForm";
import { OPERATION_TIME_ZONE } from "@/lib/shifts/time";
import { createClient } from "@/lib/supabase/server";

// Retorna a data de hoje no fuso operacional no formato exigido pelo input type="date".
function getTodayInOperationTimeZone(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Tela administrativa usada para criar um novo plantão.
export default async function NewShiftPage() {
  const supabase = await createClient();

  // Carrega as quatro equipes operacionais ativas.
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("active", true)
    .order("name");

  // Carrega somente agentes ativos porque usuários inativos não podem entrar na escala.
  const { data: agents, error: agentsError } = await supabase
    .from("profiles")
    .select("id, full_name, registration_number, work_hours")
    .eq("role", "agent")
    .eq("status", "active")
    .order("full_name");

  // Carrega os vínculos que informam em quais equipes cada agente pode atuar.
  const { data: agentTeams, error: linksError } = await supabase
    .from("agent_teams")
    .select("agent_id, team_id");

  if (teamsError || agentsError || linksError) {
    throw new Error(
      teamsError?.message ??
        agentsError?.message ??
        linksError?.message ??
        "Não foi possível carregar os dados da escala.",
    );
  }

  // Agrupa IDs de equipes por agente para o formulário filtrar as opções.
  const teamIdsByAgent = new Map<string, string[]>();

  for (const link of agentTeams ?? []) {
    const current = teamIdsByAgent.get(link.agent_id) ?? [];
    current.push(link.team_id);
    teamIdsByAgent.set(link.agent_id, current);
  }

  // Converte os dados do banco para o formato simples do componente cliente.
  const agentOptions = (agents ?? []).map((agent) => ({
    id: agent.id,
    fullName: agent.full_name,
    registrationNumber: agent.registration_number ?? "Sem matrícula",
    workHours: agent.work_hours === 24 ? (24 as const) : (12 as const),
    teamIds: teamIdsByAgent.get(agent.id) ?? [],
  }));

  return (
    <section className="admin-form-page shift-admin-page">
      <div className="topbar">
        <div>
          <div className="metric-label">Escalas / Plantões</div>
          <h1 style={{ margin: "4px 0" }}>Novo plantão</h1>
          <p className="metric-label" style={{ margin: "6px 0 0" }}>
            Crie o plantão de 07h a 07h e informe os agentes de 12h ou 24h.
          </p>
        </div>

        <Link className="button button-secondary" href="/admin/escalas">
          Voltar
        </Link>
      </div>

      <ShiftForm
        teams={teams ?? []}
        agents={agentOptions}
        defaultServiceDate={getTodayInOperationTimeZone()}
      />
    </section>
  );
}
