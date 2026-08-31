import Link from "next/link";
import { Car, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeSearchTerm } from "@/lib/utils/query";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function VehiclesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = safeSearchTerm(params.q ?? "");
  const supabase = await createClient();

  let vehicleQuery = supabase
    .from("vehicles")
    .select("plate,vehicle_type,brand_model,company_name,fleet_prefix,route_name,active,last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (q) vehicleQuery = vehicleQuery.or(`plate.ilike.%${q}%,company_name.ilike.%${q}%,brand_model.ilike.%${q}%,fleet_prefix.ilike.%${q}%`);

  const [{ data: vehicles, error }, { data: inspectionRows }] = await Promise.all([
    vehicleQuery,
    supabase.from("inspections").select("plate,infraction_type_id,enforcement_action").eq("status", "active").limit(20000),
  ]);

  const totalByPlate = new Map<string, number>();
  const notifiedByPlate = new Map<string, number>();
  for (const item of inspectionRows ?? []) {
    totalByPlate.set(item.plate, (totalByPlate.get(item.plate) ?? 0) + 1);
    if (item.infraction_type_id) notifiedByPlate.set(item.plate, (notifiedByPlate.get(item.plate) ?? 0) + 1);
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="eyebrow">Cadastros</div>
          <h1 className="page-title">Veículos</h1>
          <p className="page-subtitle">Consulte veículos, histórico, quantidade de fiscalizações e notificações por placa.</p>
        </div>
        <Link className="button" href="/admin/veiculos/novo"><Plus size={18} /> Novo veículo</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form className="search-row" method="GET" action="/admin/veiculos">
          <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Placa, empresa, modelo ou prefixo" />
          <button className="button"><Search size={18} /> Pesquisar</button>
        </form>
        {q && <div style={{ marginTop: 10 }}><Link className="table-action" href="/admin/veiculos"><X size={14} style={{ verticalAlign: "middle" }} /> Limpar busca</Link></div>}
      </div>

      {error && <div className="notice notice-error">Falha ao carregar veículos: {error.message}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Placa</th><th>Tipo</th><th>Marca/modelo</th><th>Empresa</th><th>Prefixo</th><th>Fiscalizações</th><th>Notificações</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(vehicles ?? []).map((vehicle) => (
                <tr key={vehicle.plate}>
                  <td><strong>{vehicle.plate}</strong></td>
                  <td>{vehicle.vehicle_type ?? "—"}</td>
                  <td>{vehicle.brand_model ?? "—"}</td>
                  <td>{vehicle.company_name ?? "—"}</td>
                  <td>{vehicle.fleet_prefix ?? "—"}</td>
                  <td>{totalByPlate.get(vehicle.plate) ?? 0}</td>
                  <td><strong>{notifiedByPlate.get(vehicle.plate) ?? 0}</strong></td>
                  <td><span className={`status-badge ${vehicle.active ? "status-active" : "status-inactive"}`}>{vehicle.active ? "Ativo" : "Inativo"}</span></td>
                  <td><Link className="table-action" href={`/admin/veiculos/${vehicle.plate}`}>Abrir histórico</Link></td>
                </tr>
              ))}
              {(vehicles?.length ?? 0) === 0 && <tr><td colSpan={9} className="empty-state"><Car size={24} /> Nenhum veículo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
