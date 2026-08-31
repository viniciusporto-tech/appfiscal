import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { enforcementLabel } from "@/lib/inspections/labels";
import { formatDateTime } from "@/lib/utils/format";

export default async function AgentInspectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("inspections")
    .select("id,occurrence_number,plate,captured_at,vehicle_type,address,enforcement_action,infraction_types(name),teams(name)")
    .eq("agent_id", user!.id)
    .order("captured_at", { ascending: false })
    .limit(200);

  return (
    <main className="agent-page">
      <div className="agent-container">
        <div className="topbar">
          <div><div className="eyebrow">Área do agente</div><h1 className="page-title">Minhas fiscalizações</h1><p className="page-subtitle">Seu histórico de registros.</p></div>
          <Link className="button button-secondary" href="/agente">Voltar</Link>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Ocorrência</th><th>Placa</th><th>Infração</th><th>Resultado</th><th>Equipe</th><th>Endereço</th></tr></thead>
              <tbody>
                {(data ?? []).map((item: any) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.captured_at)}</td><td>{item.occurrence_number}</td><td><strong>{item.plate}</strong></td><td>{item.infraction_types?.name ?? "Somente fiscalização"}</td><td>{enforcementLabel(item.enforcement_action)}</td><td>{item.teams?.name ?? "—"}</td><td className="address-cell">{item.address ?? "—"}</td>
                  </tr>
                ))}
                {(data?.length ?? 0) === 0 && <tr><td colSpan={7} className="empty-state">Você ainda não registrou fiscalizações.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
