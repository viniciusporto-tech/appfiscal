import { notFound } from "next/navigation";
import Link from "next/link";
import { AgentForm } from "@/components/admin/AgentForm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ id: string }> };

export default async function EditAgentPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: agent }, { data: teams }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, registration_number, full_name, phone, work_hours, status, role").eq("id", id).single(),
    supabase.from("teams").select("id, name").eq("active", true).order("name"),
    supabase.from("agent_teams").select("team_id, default_period").eq("agent_id", id),
  ]);
  if (!agent || agent.role !== "agent") notFound();
  const adminSupabase = createAdminClient();
  const { data: authUser } = await adminSupabase.auth.admin.getUserById(id);
  return <section className="admin-form-page"><div className="topbar"><div><div className="eyebrow">Agentes</div><h1 className="page-title">Editar agente</h1><p className="page-subtitle">{agent.full_name}</p></div><Link className="button button-secondary" href="/admin/agentes">Voltar</Link></div><AgentForm teams={teams ?? []} initial={{ id, fullName: agent.full_name, registrationNumber: agent.registration_number ?? "", phone: agent.phone ?? "", email: authUser.user?.email ?? "", workHours: agent.work_hours === 12 ? 12 : 24, status: agent.status === "inactive" ? "inactive" : "active", memberships: (memberships ?? []).map((m) => ({ teamId: m.team_id, period: m.default_period as "day" | "night" | "full" })) }} /></section>;
}
