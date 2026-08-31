import Link from "next/link";
import { AgentForm } from "@/components/admin/AgentForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewAgentPage() {
  const supabase = await createClient();
  const { data: teams } = await supabase.from("teams").select("id, name").eq("active", true).order("name");
  return <section className="admin-form-page"><div className="topbar"><div><div className="eyebrow">Agentes</div><h1 className="page-title">Novo agente</h1></div><Link className="button button-secondary" href="/admin/agentes">Voltar</Link></div><AgentForm teams={teams ?? []} /></section>;
}
