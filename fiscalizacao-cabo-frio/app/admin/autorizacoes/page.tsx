import Link from "next/link";
import { BusFront, Plus, Settings2, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { authorizationBadgeClass, authorizationStatus, authorizationStatusLabels } from "@/lib/authorizations/status";
import { safeSearchTerm } from "@/lib/utils/query";

type Props = { searchParams: Promise<{ q?: string; service?: string; active?: string }> };

function dateBr(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function shortTime(value: string | null) {
  return value ? value.slice(0, 5) : "Livre";
}

export default async function AuthorizationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = safeSearchTerm(params.q ?? "");
  const supabase = await createClient();

  const { data: serviceTypes } = await supabase.from("service_types").select("id,name,active").order("name");

  let query = supabase
    .from("vehicle_authorizations")
    .select(`
      id,plate,company_name,valid_from,valid_until,permitted_start_time,permitted_end_time,allowed_area,active,
      service_types(id,name),
      vehicles(vehicle_type,brand_model,color,fleet_prefix)
    `)
    .order("valid_until", { ascending: false })
    .limit(1000);

  if (q) query = query.or(`plate.ilike.%${q}%,company_name.ilike.%${q}%,allowed_area.ilike.%${q}%`);
  if (params.service) query = query.eq("service_type_id", params.service);
  if (params.active === "active") query = query.eq("active", true);
  if (params.active === "revoked") query = query.eq("active", false);

  const { data, error } = await query;
  const rows = data ?? [];
  const hasFilters = Boolean(q || params.service || params.active);

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="eyebrow">Transporte autorizado</div>
          <h1 className="page-title">Veículos autorizados</h1>
          <p className="page-subtitle">Cadastre ônibus e vans autorizados, período, horário, área de circulação e tipo de serviço.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button button-secondary" href="/admin/autorizacoes/tipos"><Settings2 size={18} /> Tipos de serviço</Link>
          <Link className="button" href="/admin/autorizacoes/novo"><Plus size={18} /> Nova autorização</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="GET" action="/admin/autorizacoes" className="grid grid-3">
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Busca</label>
            <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Placa, empresa ou área" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Tipo de serviço</label>
            <select className="select" name="service" defaultValue={params.service ?? ""}>
              <option value="">Todos</option>
              {(serviceTypes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Cadastro</label>
            <select className="select" name="active" defaultValue={params.active ?? ""}>
              <option value="">Ativos e revogados</option>
              <option value="active">Somente ativos</option>
              <option value="revoked">Somente revogados</option>
            </select>
          </div>
          <div className="topbar-actions" style={{ gridColumn: "1 / -1" }}>
            <button className="button"><Search size={18} /> Pesquisar</button>
            {hasFilters && <Link className="button button-secondary" href="/admin/autorizacoes"><X size={18} /> Limpar</Link>}
          </div>
        </form>
      </div>

      {error && <div className="notice notice-error">Falha ao carregar autorizações: {error.message}. Execute a migration 009_authorized_vehicles.sql.</div>}

      <div className="card">
        <div className="section-heading"><h2>Autorizações cadastradas</h2><span className="status-badge status-scheduled">{rows.length} registro(s)</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Placa</th><th>Veículo</th><th>Empresa</th><th>Serviço</th><th>Validade</th><th>Horário</th><th>Área</th><th>Status agora</th><th></th></tr></thead>
            <tbody>
              {(rows as any[]).map((row) => {
                const status = authorizationStatus(row);
                return (
                  <tr key={row.id}>
                    <td><strong>{row.plate}</strong></td>
                    <td>{row.vehicles?.vehicle_type ?? "—"}{row.vehicles?.fleet_prefix ? ` • ${row.vehicles.fleet_prefix}` : ""}</td>
                    <td>{row.company_name}</td>
                    <td>{row.service_types?.name ?? "—"}</td>
                    <td>{dateBr(row.valid_from)} → {dateBr(row.valid_until)}</td>
                    <td>{shortTime(row.permitted_start_time)} → {shortTime(row.permitted_end_time)}</td>
                    <td className="address-cell">{row.allowed_area ?? "Sem restrição cadastrada"}</td>
                    <td><span className={`status-badge ${authorizationBadgeClass(status)}`}>{authorizationStatusLabels[status]}</span></td>
                    <td><Link className="table-action" href={`/admin/autorizacoes/${row.id}`}>Abrir</Link></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="empty-state"><BusFront size={24} /> Nenhuma autorização encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
