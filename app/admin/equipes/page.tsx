import Link from "next/link";
import { UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function TeamsPage() {
  const supabase = await createClient();
  const [{ data: teams }, { data: links }] = await Promise.all([
    supabase.from("teams").select("id, code, name, description, active").order("name"),
    supabase.from("agent_teams").select("team_id, agent_id"),
  ]);
  const countByTeam = new Map<string, number>(); for (const l of links ?? []) countByTeam.set(l.team_id, (countByTeam.get(l.team_id) ?? 0) + 1);
  return <section><div className="topbar"><div><div className="eyebrow">Operação</div><h1 className="page-title">Equipes</h1><p className="page-subtitle">Gerencie as equipes e veja quantos agentes estão vinculados a cada uma.</p></div><Link className="button" href="/admin/equipes/novo"><UsersRound size={18}/> Nova equipe</Link></div><div className="grid grid-2">{(teams ?? []).map((team) => <div className="card" key={team.id}><div className="section-heading"><div><span className={`status-badge ${team.active ? "status-active" : "status-inactive"}`}>{team.active ? "Ativa" : "Inativa"}</span><h2 style={{ marginTop: 10 }}>{team.name}</h2></div><Link className="table-action" href={`/admin/equipes/${team.id}`}>Editar</Link></div><p className="page-subtitle">{team.description || "Sem descrição."}</p><div className="detail-grid" style={{ marginTop: 14 }}><div className="detail-item"><span>Código</span><strong>{team.code}</strong></div><div className="detail-item"><span>Agentes vinculados</span><strong>{countByTeam.get(team.id) ?? 0}</strong></div></div></div>)}</div></section>;
}
