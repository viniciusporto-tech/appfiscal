import Link from "next/link";
import { AgentStatusButton } from "@/components/admin/AgentStatusButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Tipo local usado para organizar os vínculos agente/equipe retornados pelo banco.
type AgentTeamLink = {
  agent_id: string;
  team_id: string;
};

// Página principal de gestão dos agentes.
export default async function AdminAgentsPage() {
  // Cliente da sessão atual: as consultas comuns continuam protegidas por RLS.
  const supabase = await createClient();

  // Carrega somente usuários com perfil de agente.
  const { data: agents, error: agentsError } = await supabase
    .from("profiles")
    .select("id, registration_number, full_name, work_hours, status, created_at")
    .eq("role", "agent")
    .order("full_name");

  // Carrega as equipes para transformar IDs em nomes legíveis.
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .order("name");

  // Carrega os vínculos administrativos entre agentes e equipes.
  const { data: agentTeams, error: agentTeamsError } = await supabase
    .from("agent_teams")
    .select("agent_id, team_id");

  // Mostra um erro claro se a leitura básica do banco falhar.
  if (agentsError || teamsError || agentTeamsError) {
    throw new Error(
      agentsError?.message ??
        teamsError?.message ??
        agentTeamsError?.message ??
        "Não foi possível carregar os agentes.",
    );
  }

  // O e-mail vive no Supabase Auth, por isso esta leitura acontece apenas no servidor.
  const adminSupabase = createAdminClient();

  // Para o MVP, até 1000 usuários são carregados em uma página.
  // Se o sistema crescer além disso, esta tela será paginada.
  const { data: authUsersData, error: authUsersError } =
    await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (authUsersError) {
    throw new Error(authUsersError.message);
  }

  // Mapa rápido UUID -> e-mail evita procurar repetidamente na lista.
  const emailByUserId = new Map(
    authUsersData.users.map((user) => [user.id, user.email ?? "Sem e-mail"]),
  );

  // Mapa rápido ID da equipe -> nome da equipe.
  const teamNameById = new Map((teams ?? []).map((team) => [team.id, team.name]));

  // Agrupa os vínculos por agente.
  const teamIdsByAgent = new Map<string, string[]>();

  for (const link of (agentTeams ?? []) as AgentTeamLink[]) {
    const current = teamIdsByAgent.get(link.agent_id) ?? [];
    current.push(link.team_id);
    teamIdsByAgent.set(link.agent_id, current);
  }

  // Quantidades usadas nos cartões superiores.
  const totalAgents = agents?.length ?? 0;
  const activeAgents = agents?.filter((agent) => agent.status === "active").length ?? 0;
  const inactiveAgents = totalAgents - activeAgents;

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="metric-label">Administração</div>
          <h1 style={{ margin: "4px 0" }}>Agentes</h1>
          <p className="metric-label" style={{ margin: "6px 0 0" }}>
            Cadastre usuários, jornadas e equipes permitidas sem precisar abrir o Supabase.
          </p>
        </div>

        <Link className="button" href="/admin/agentes/novo">
          + Novo agente
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="card compact-card">
          <div className="metric-label">Total de agentes</div>
          <div className="metric-value">{totalAgents}</div>
        </div>
        <div className="card compact-card">
          <div className="metric-label">Ativos</div>
          <div className="metric-value">{activeAgents}</div>
        </div>
        <div className="card compact-card">
          <div className="metric-label">Inativos</div>
          <div className="metric-value">{inactiveAgents}</div>
        </div>
        <div className="card compact-card">
          <div className="metric-label">Equipes</div>
          <div className="metric-value">{teams?.length ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <h2 style={{ margin: 0 }}>Agentes cadastrados</h2>
            <p className="metric-label" style={{ marginBottom: 0 }}>
              Desativar um agente bloqueia o acesso, mas não apaga o histórico de fiscalizações.
            </p>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Agente</th>
                <th>E-mail</th>
                <th>Jornada</th>
                <th>Equipes</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {agents?.map((agent) => {
                // Equipes permitidas para este agente.
                const teamIds = teamIdsByAgent.get(agent.id) ?? [];

                // Converte IDs em nomes para exibição.
                const teamNames = teamIds
                  .map((teamId) => teamNameById.get(teamId))
                  .filter((name): name is string => Boolean(name));

                // E-mail vem do Auth e fica disponível apenas nesta renderização do servidor.
                const email = emailByUserId.get(agent.id) ?? "Sem e-mail";

                // A jornada antiga pode ser nula; o formulário usa 12h como padrão visual.
                const workHours = agent.work_hours === 24 ? 24 : 12;

                return (
                  <tr key={agent.id}>
                    <td>{agent.registration_number ?? "—"}</td>
                    <td>
                      <strong>{agent.full_name}</strong>
                    </td>
                    <td>{email}</td>
                    <td>{workHours}h</td>
                    <td>{teamNames.length > 0 ? teamNames.join(" / ") : "Sem vínculo"}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          agent.status === "active"
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {agent.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link className="table-action" href={`/admin/agentes/${agent.id}`}>
                          Editar
                        </Link>
                        <AgentStatusButton
                          agent={{
                            id: agent.id,
                            fullName: agent.full_name,
                            registrationNumber: agent.registration_number ?? "",
                            email,
                            workHours,
                            status:
                              agent.status === "inactive" ? "inactive" : "active",
                            teamIds,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {totalAgents === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Nenhum agente cadastrado. Clique em “Novo agente” para criar o primeiro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
