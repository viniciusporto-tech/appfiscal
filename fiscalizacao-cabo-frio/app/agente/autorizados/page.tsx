import Link from "next/link";
import { BusFront, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { authorizationBadgeClass, authorizationStatus, authorizationStatusLabels } from "@/lib/authorizations/status";
import { safeSearchTerm } from "@/lib/utils/query";

type Props = { searchParams: Promise<{ q?: string }> };

function dateBr(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function shortTime(value: string | null) {
  return value ? value.slice(0, 5) : "Livre";
}

export default async function AuthorizedVehiclesAgentPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = safeSearchTerm(params.q ?? "");
  const supabase = await createClient();

  let query = supabase
    .from("vehicle_authorizations")
    .select(`id,plate,company_name,valid_from,valid_until,permitted_start_time,permitted_end_time,allowed_area,notes,active,service_types(name),vehicles(vehicle_type,brand_model,color,fleet_prefix)`)
    .order("valid_until", { ascending: false })
    .limit(500);
  if (q) query = query.or(`plate.ilike.%${q}%,company_name.ilike.%${q}%,allowed_area.ilike.%${q}%`);

  const { data, error } = await query;
  const rows = data ?? [];

  return (
    <main className="agent-page">
      <div className="agent-container agent-container-wide">
        <div className="topbar">
          <div><div className="eyebrow">Área do agente</div><h1 className="page-title">Veículos autorizados</h1><p className="page-subtitle">Consulte ônibus e vans, validade, serviço, horário e local autorizado.</p></div>
          <Link className="button button-secondary" href="/agente">Voltar</Link>
        </div>

        <form className="card" method="GET" action="/agente/autorizados" style={{ marginBottom: 14 }}>
          <div className="search-row">
            <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Placa, empresa ou local" />
            <button className="button"><Search size={18} /> Pesquisar</button>
          </div>
          {q && <div style={{ marginTop: 10 }}><Link className="table-action" href="/agente/autorizados"><X size={14} style={{ verticalAlign: "middle" }} /> Limpar busca</Link></div>}
        </form>

        {error && <div className="notice notice-error">Não foi possível consultar autorizações: {error.message}</div>}

        <div className="authorized-card-list">
          {(rows as any[]).map((row) => {
            const status = authorizationStatus(row);
            return (
              <article className={`card authorization-card authorization-${status}`} key={row.id}>
                <div className="authorization-card-header">
                  <div>
                    <div className="authorization-plate"><BusFront size={20} /> {row.plate}</div>
                    <div className="field-help">{row.vehicles?.vehicle_type ?? "Veículo"}{row.vehicles?.fleet_prefix ? ` • Prefixo ${row.vehicles.fleet_prefix}` : ""}</div>
                  </div>
                  <span className={`status-badge ${authorizationBadgeClass(status)}`}>{authorizationStatusLabels[status]}</span>
                </div>
                <div className="detail-grid">
                  <div className="detail-item"><span>Empresa</span><strong>{row.company_name}</strong></div>
                  <div className="detail-item"><span>Tipo de serviço</span><strong>{row.service_types?.name ?? "—"}</strong></div>
                  <div className="detail-item"><span>Validade</span><strong>{dateBr(row.valid_from)} → {dateBr(row.valid_until)}</strong></div>
                  <div className="detail-item"><span>Horário permitido</span><strong>{shortTime(row.permitted_start_time)} → {shortTime(row.permitted_end_time)}</strong></div>
                </div>
                <div className="authorization-area"><span>Local / área permitida</span><strong>{row.allowed_area ?? "Sem restrição de área cadastrada."}</strong></div>
                {row.notes && <div className="notice">{row.notes}</div>}
              </article>
            );
          })}
          {rows.length === 0 && <div className="card empty-state">Nenhum veículo autorizado encontrado.</div>}
        </div>
      </div>
    </main>
  );
}
