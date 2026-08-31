import Link from "next/link";
import { Activity, AlertTriangle, BusFront, CalendarDays, Car, FileText, Map as MapIcon, Plus, Users, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [inspectionsResult, agentsResult, teamsResult, vehiclesResult, latestResult] = await Promise.all([
    supabase.from("inspections").select("id, team_id, plate, infraction_type_id", { count: "exact" }).gte("captured_at", monthStart).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "agent").eq("status", "active"),
    supabase.from("teams").select("id, name").eq("active", true).order("name"),
    supabase.from("vehicles").select("plate", { count: "exact", head: true }).eq("active", true),
    supabase.from("inspections").select("id, occurrence_number, plate, captured_at, team_id, profiles!inspections_agent_id_fkey(full_name), infraction_types(name)").order("captured_at", { ascending: false }).limit(8),
  ]);

  const inspections = inspectionsResult.data ?? [];
  const teams = teamsResult.data ?? [];
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamCounts = new Map<string, number>();
  const plateCounts = new Map<string, number>();
  let notificationCount = 0;

  for (const item of inspections) {
    teamCounts.set(item.team_id, (teamCounts.get(item.team_id) ?? 0) + 1);
    plateCounts.set(item.plate, (plateCounts.get(item.plate) ?? 0) + 1);
    if (item.infraction_type_id) notificationCount++;
  }

  const recurrent = Array.from(plateCounts.values()).filter((count) => count > 1).length;
  const maxTeam = Math.max(1, ...Array.from(teamCounts.values()));

  const quickLinks = [
    { href: "/admin/fiscalizacoes", label: "Fiscalizações", icon: Activity },
    { href: "/admin/veiculos", label: "Veículos", icon: Car },
    { href: "/admin/equipes", label: "Equipes", icon: UsersRound },
    { href: "/admin/agentes", label: "Agentes", icon: Users },
    { href: "/admin/escalas", label: "Escalas", icon: CalendarDays },
    { href: "/admin/infracoes", label: "Infrações", icon: AlertTriangle },
    { href: "/admin/autorizacoes", label: "Autorizados", icon: BusFront },
    { href: "/admin/mapa", label: "Mapa", icon: MapIcon },
    { href: "/admin/relatorios", label: "Relatórios", icon: FileText },
  ];

  return (
    <section>
      <div className="card dashboard-hero" style={{ marginBottom: 18 }}>
        <div className="dashboard-hero-content">
          <div className="eyebrow" style={{ color: "#a8caef" }}>Painel operacional</div>
          <h1 className="page-title">Fiscalização Cabo Frio</h1>
          <p className="page-subtitle">Acompanhe atuação das equipes, fiscalizações, veículos e plantões em um único lugar.</p>
          <div className="topbar-actions" style={{ marginTop: 18 }}>
            <Link className="button" href="/admin/escalas/lote"><CalendarDays size={18}/> Gerar escala 24×72</Link>
            <Link className="button button-secondary" href="/admin/infracoes/novo"><Plus size={18}/> Cadastrar infração</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="card kpi-card"><div className="kpi-icon"><Activity size={20}/></div><div className="metric-label">Fiscalizações no mês</div><div className="metric-value">{inspectionsResult.count ?? inspections.length}</div><div className="metric-help">Registros ativos no período</div></div>
        <div className="card kpi-card"><div className="kpi-icon"><AlertTriangle size={20}/></div><div className="metric-label">Com infração</div><div className="metric-value">{notificationCount}</div><div className="metric-help">Fiscalizações vinculadas a tipo de infração</div></div>
        <div className="card kpi-card"><div className="kpi-icon"><Car size={20}/></div><div className="metric-label">Veículos ativos</div><div className="metric-value">{vehiclesResult.count ?? 0}</div><div className="metric-help">Reincidentes no mês: {recurrent}</div></div>
        <div className="card kpi-card"><div className="kpi-icon"><Users size={20}/></div><div className="metric-label">Agentes ativos</div><div className="metric-value">{agentsResult.count ?? 0}</div><div className="metric-help">Equipes ativas: {teams.length}</div></div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="section-heading"><h2>Atuação das equipes — mês atual</h2><Link className="table-action" href="/admin/equipes">Ver equipes</Link></div>
          <div className="team-progress">
            {teams.map((team) => {
              const value = teamCounts.get(team.id) ?? 0;
              return <div className="team-progress-row" key={team.id}><strong>{team.name.replace("Equipe ", "")}</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((value / maxTeam) * 100)}%` }}/></div><strong>{value}</strong></div>;
            })}
            {teams.length === 0 && <div className="empty-state">Cadastre as equipes para visualizar o comparativo.</div>}
          </div>
        </div>

        <div className="card">
          <div className="section-heading"><h2>Acessos rápidos</h2></div>
          <div className="quick-admin-grid">
            {quickLinks.map(({ href, label, icon: Icon }) => <Link className="quick-admin-link" href={href} key={href}><span className="quick-admin-icon"><Icon size={18}/></span>{label}</Link>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-heading"><h2>Fiscalizações recentes</h2><Link className="table-action" href="/admin/fiscalizacoes">Abrir todas</Link></div>
        <div className="table-wrap"><table><thead><tr><th>Ocorrência</th><th>Data</th><th>Placa</th><th>Infração</th><th>Equipe</th><th>Agente</th></tr></thead><tbody>
          {(latestResult.data ?? []).map((item: any) => <tr key={item.id}><td><Link className="table-action" href={`/admin/fiscalizacoes/${item.id}`}>{item.occurrence_number}</Link></td><td>{formatDateTime(item.captured_at)}</td><td><strong>{item.plate}</strong></td><td>{item.infraction_types?.name ?? "Sem infração"}</td><td>{teamName.get(item.team_id) ?? "—"}</td><td>{item.profiles?.full_name ?? "—"}</td></tr>)}
          {(latestResult.data?.length ?? 0) === 0 && <tr><td colSpan={6} className="empty-state">Nenhuma fiscalização registrada ainda.</td></tr>}
        </tbody></table></div>
      </div>
    </section>
  );
}
