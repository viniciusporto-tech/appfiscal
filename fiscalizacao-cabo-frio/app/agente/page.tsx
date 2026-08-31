import Link from "next/link";
import { BookOpen, BusFront, CalendarDays, Car, ClipboardList, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";
import { ServiceWorkerRegister } from "@/components/ui/ServiceWorkerRegister";
import { LogoutButton } from "@/components/agent/LogoutButton";
import { SyncButton } from "@/components/agent/SyncButton";

export default async function AgentHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [{ data: profile }, { data: shift }, { count: todayCount }] = await Promise.all([
    supabase.from("profiles").select("full_name,registration_number").eq("id", user!.id).single(),
    supabase.from("shift_agents").select("starts_at,ends_at,team_id,teams(name)").eq("agent_id", user!.id).eq("status", "scheduled").lte("starts_at", now).gte("ends_at", now).limit(1).maybeSingle(),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("agent_id", user!.id).gte("captured_at", dayStart.toISOString()),
  ]);

  return (
    <main className="agent-page">
      <ServiceWorkerRegister />
      <div className="agent-container">
        <header className="agent-header">
          <div className="agent-header-title">
            <div><div className="muted-light">Sistema de Fiscalização</div><h1>{profile?.full_name ?? "Agente"}</h1><div className="muted-light">Matrícula {profile?.registration_number ?? "—"}</div></div>
            <span className="status-badge status-active">Online</span>
          </div>
          <div className="agent-shift-card">
            {shift ? <><strong>{(shift as any).teams?.name ?? "Equipe"}</strong><span>{formatDateTime(shift.starts_at)} → {formatDateTime(shift.ends_at)}</span></> : <><strong>Sem plantão ativo</strong><span>Consulte a administração antes de registrar ocorrências.</span></>}
          </div>
        </header>

        <Link className="button agent-primary-action" href="/agente/nova"><Plus size={20} /> Nova fiscalização</Link>

        <div className="agent-actions">
          <Link className="agent-action" href="/agente/fiscalizacoes"><span className="agent-action-icon"><ClipboardList size={20} /></span>Minhas fiscalizações</Link>
          <Link className="agent-action" href="/agente/veiculos"><span className="agent-action-icon"><Search size={20} /></span>Consultar veículo</Link>
          <Link className="agent-action" href="/agente/autorizados"><span className="agent-action-icon"><BusFront size={20} /></span>Veículos autorizados</Link>
          <Link className="agent-action" href="/agente/plantao"><span className="agent-action-icon"><CalendarDays size={20} /></span>Meu plantão</Link>
          <Link className="agent-action" href="/agente/decretos"><span className="agent-action-icon"><BookOpen size={20} /></span>Decretos</Link>
          <SyncButton />
          <Link className="agent-action" href="/agente/fiscalizacoes"><span className="agent-action-icon"><Car size={20} /></span>Hoje: {todayCount ?? 0} registros</Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
