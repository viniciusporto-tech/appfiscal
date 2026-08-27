import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentForm } from "@/components/admin/AgentForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Parâmetros recebidos da rota /admin/agentes/:id.
type EditAgentPageProps = {
  params: Promise<{ id: string }>;
};

// Tela usada para editar um agente existente.
export default async function EditAgentPage({ params }: EditAgentPageProps) {
  // Obtém o UUID do agente informado na URL.
  const { id: agentId } = await params;

  // Cliente comum protegido pelo RLS.
  const supabase = await createClient();

  // Carrega os dados funcionais do agente.
  const { data: agent, error: agentError } = await supabase
    .from("profiles")
    .select("id, registration_number, full_name, role, work_hours, status")
    .eq("id", agentId)
    .single();

  // A página só existe para usuários do tipo agente.
  if (agentError || !agent || agent.role !== "agent") {
    notFound();
  }

  // Carrega as equipes disponíveis no sistema.
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (teamsError) {
    throw new Error(teamsError.message);
  }

  // Descobre quais equipes já estão vinculadas a este agente.
  const { data: links, error: linksError } = await supabase
    .from("agent_teams")
    .select("team_id")
    .eq("agent_id", agentId);

  if (linksError) {
    throw new Error(linksError.message);
  }

  // O e-mail não fica duplicado em profiles; ele é lido diretamente do Supabase Auth.
  const adminSupabase = createAdminClient();
  const { data: authUserData, error: authUserError } =
    await adminSupabase.auth.admin.getUserById(agentId);

  if (authUserError || !authUserData.user) {
    throw new Error(authUserError?.message ?? "Login do agente não encontrado.");
  }

  // Converte os vínculos existentes para uma lista simples de IDs.
  const teamIds = (links ?? []).map((link) => link.team_id);

  return (
    <section className="admin-form-page">
      <div className="topbar">
        <div>
          <div className="metric-label">Agentes</div>
          <h1 style={{ margin: "4px 0" }}>Editar agente</h1>
          <p className="metric-label" style={{ margin: "6px 0 0" }}>
            {agent.full_name}
          </p>
        </div>

        <Link className="button button-secondary" href="/admin/agentes">
          Voltar
        </Link>
      </div>

      <AgentForm
        teams={teams ?? []}
        initialValues={{
          id: agent.id,
          fullName: agent.full_name,
          registrationNumber: agent.registration_number ?? "",
          email: authUserData.user.email ?? "",
          workHours: agent.work_hours === 24 ? 24 : 12,
          status: agent.status === "inactive" ? "inactive" : "active",
          teamIds,
        }}
      />
    </section>
  );
}
