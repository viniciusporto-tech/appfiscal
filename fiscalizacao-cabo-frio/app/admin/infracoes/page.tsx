import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("infraction_types")
    .select("id,code,name,category,severity,active,allowed_vehicle_types")
    .order("name");

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="eyebrow">Cadastros</div>
          <h1 className="page-title">Infrações</h1>
          <p className="page-subtitle">Cadastre infrações gerais ou específicas para Táxi, Ônibus, Van e outros tipos de veículo.</p>
        </div>
        <Link className="button" href="/admin/infracoes/novo"><Plus size={18} /> Nova infração</Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Código</th><th>Infração</th><th>Categoria</th><th>Aplicação</th><th>Gravidade</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((item) => {
                const allowed = item.allowed_vehicle_types ?? [];
                return (
                  <tr key={item.id}>
                    <td>{item.code ?? "—"}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.category}</td>
                    <td>{allowed.length ? allowed.join(", ") : "Todos os veículos"}</td>
                    <td>{item.severity}</td>
                    <td><span className={`status-badge ${item.active ? "status-active" : "status-inactive"}`}>{item.active ? "Ativa" : "Inativa"}</span></td>
                    <td><Link className="table-action" href={`/admin/infracoes/${item.id}`}>Editar</Link></td>
                  </tr>
                );
              })}
              {(data?.length ?? 0) === 0 && <tr><td colSpan={7} className="empty-state">Nenhuma infração cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
