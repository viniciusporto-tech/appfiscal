import Link from "next/link";
import { AgentForm } from "@/components/admin/AgentForm";
import { createClient } from "@/lib/supabase/server";

// Tela administrativa usada para cadastrar um novo agente.
export default async function NewAgentPage() {
  // Usa a sessão do administrador para carregar as equipes permitidas pelo RLS.
  const supabase = await createClient();

  // Somente equipes ativas aparecem para novos vínculos.
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <section className="admin-form-page">
      <div className="topbar">
        <div>
          <div className="metric-label">Agentes</div>
          <h1 style={{ margin: "4px 0" }}>Novo agente</h1>
          <p className="metric-label" style={{ margin: "6px 0 0" }}>
            O login e o perfil interno serão criados juntos.
          </p>
        </div>

        <Link className="button button-secondary" href="/admin/agentes">
          Voltar
        </Link>
      </div>

      <AgentForm teams={teams ?? []} />
    </section>
  );
}
