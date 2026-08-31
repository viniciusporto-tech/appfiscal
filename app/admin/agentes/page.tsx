import Link from "next/link";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AgentsPage() {
  const supabase = await createClient();
  const [{ data: agents }, { data: teams }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id, registration_number, full_name, work_hours, status, phone").eq("role", "agent").order("full_name"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("agent_teams").select("agent_id, team_id, default_period"),
  ]);

  const adminSupabase = createAdminClient();
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const linksByAgent = new Map<string, typeof links>();
  for (const link of links ?? []) linksByAgent.set(link.agent_id, [...(linksByAgent.get(link.agent_id) ?? []), link]);

  const active = (agents ?? []).filter((a) => a.status === "active").length;

  return (
    <section>
      <div className="topbar">
        <div><div className="eyebrow">Operação</div><h1 className="page-title">Agentes</h1><p className="page-subtitle">Cadastre login, jornada, equipes e período padrão sem abrir o Supabase.</p></div>
        <Link className="button" href="/admin/agentes/novo"><UserPlus size={18} /> Novo agente</Link>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card"><div className="metric-label">Cadastrados</div><div className="metric-value">{agents?.length ?? 0}</div></div>
        <div className="card"><div className="metric-label">Ativos</div><div className="metric-value">{active}</div></div>
        <div className="card"><div className="metric-label">Inativos</div><div className="metric-value">{(agents?.length ?? 0) - active}</div></div>
      </div>
      <div className="card">
        <div className="table-wrap"><table><thead><tr><th>Matrícula</th><th>Agente</th><th>E-mail</th><th>Jornada</th><th>Equipes</th><th>Status</th><th></th></tr></thead><tbody>
          {(agents ?? []).map((agent) => {
            const agentLinks = linksByAgent.get(agent.id) ?? [];
            const teamText = agentLinks.map((l) => `${teamById.get(l.team_id) ?? "Equipe"} (${l.default_period === "full" ? "07–07" : l.default_period === "night" ? "19–07" : "07–19"})`).join(" / ");
            return <tr key={agent.id}><td>{agent.registration_number ?? "—"}</td><td><strong>{agent.full_name}</strong></td><td>{emailById.get(agent.id) ?? "—"}</td><td>{agent.work_hours ?? "—"}h</td><td>{teamText || "Sem equipe"}</td><td><span className={`status-badge ${agent.status === "active" ? "status-active" : "status-inactive"}`}>{agent.status === "active" ? "Ativo" : "Inativo"}</span></td><td><Link className="table-action" href={`/admin/agentes/${agent.id}`}>Editar</Link></td></tr>;
          })}
          {(agents?.length ?? 0) === 0 && <tr><td colSpan={7} className="empty-state">Nenhum agente cadastrado.</td></tr>}
        </tbody></table></div>
      </div>
    </section>
  );
}
