import { ReportBuilder } from "@/components/admin/ReportBuilder";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();
  const [teamsResult, agentsResult, infractionsResult, servicesResult] = await Promise.all([
    supabase.from("teams").select("id,name").eq("active", true).order("name"),
    supabase.from("profiles").select("id,full_name,registration_number").eq("role", "agent").eq("status", "active").order("full_name"),
    supabase.from("infraction_types").select("id,name,category").order("category").order("name"),
    supabase.from("service_types").select("id,name").eq("active", true).order("name"),
  ]);

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="eyebrow">Gestão</div>
          <h1 className="page-title">Relatórios personalizados</h1>
          <p className="page-subtitle">Escolha os filtros e marque exatamente quais informações deseja incluir no PDF, Excel ou CSV.</p>
        </div>
      </div>
      <ReportBuilder
        teams={teamsResult.data ?? []}
        agents={agentsResult.data ?? []}
        infractions={infractionsResult.data ?? []}
        serviceTypes={servicesResult.data ?? []}
      />
    </section>
  );
}
