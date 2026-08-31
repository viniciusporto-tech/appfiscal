import { NewInspectionForm } from "@/components/agent/NewInspectionForm";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("infraction_types")
    .select("id,name,category,allowed_vehicle_types")
    .eq("active", true)
    .order("category")
    .order("name");

  return (
    <main className="agent-page">
      <div className="agent-container">
        <div className="topbar">
          <div>
            <div className="eyebrow">Área do agente</div>
            <h1 className="page-title">Nova fiscalização</h1>
            <p className="page-subtitle">Registre veículo, infração, foto e GPS.</p>
          </div>
        </div>
        <NewInspectionForm infractions={data ?? []} />
      </div>
    </main>
  );
}
