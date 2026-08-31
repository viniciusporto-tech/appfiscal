import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { createClient } from "@/lib/supabase/server";
import { enforcementLabel } from "@/lib/inspections/labels";
import { formatDateTime } from "@/lib/utils/format";
import { authorizationBadgeClass, authorizationStatus, authorizationStatusLabels } from "@/lib/authorizations/status";

type Props = { params: Promise<{ plate: string }> };

export default async function VehicleDetailPage({ params }: Props) {
  const { plate } = await params;
  const normalizedPlate = plate.toUpperCase();
  const supabase = await createClient();

  const [{ data: vehicle }, { data: history }, totalResult, notifiedResult, finedResult, { data: authorizations }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("plate", normalizedPlate).single(),
    supabase
      .from("inspections")
      .select("id,occurrence_number,captured_at,notes,address,enforcement_action,infraction_types(name),teams(name)")
      .eq("plate", normalizedPlate)
      .eq("status", "active")
      .order("captured_at", { ascending: false })
      .limit(100),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("plate", normalizedPlate).eq("status", "active"),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("plate", normalizedPlate).eq("status", "active").not("infraction_type_id", "is", null),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("plate", normalizedPlate).eq("status", "active").neq("enforcement_action", "none"),
    supabase.from("vehicle_authorizations").select("id,company_name,valid_from,valid_until,permitted_start_time,permitted_end_time,allowed_area,active,service_types(name)").eq("plate", normalizedPlate).order("valid_until", { ascending: false }),
  ]);

  if (!vehicle) notFound();

  return (
    <section className="admin-form-page">
      <div className="topbar">
        <div>
          <div className="eyebrow">Veículos</div>
          <h1 className="page-title">{vehicle.plate}</h1>
          <p className="page-subtitle">Histórico consolidado de fiscalizações e notificações desta placa.</p>
        </div>
        <Link className="button button-secondary" href="/admin/veiculos">Voltar</Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi-card"><div className="metric-label">Fiscalizações</div><div className="metric-value">{totalResult.count ?? 0}</div></div>
        <div className="card kpi-card"><div className="metric-label">Notificações</div><div className="metric-value">{notifiedResult.count ?? 0}</div><div className="metric-help">Registros com infração</div></div>
        <div className="card kpi-card"><div className="metric-label">Multas</div><div className="metric-value">{finedResult.count ?? 0}</div><div className="metric-help">Guarda ou Fiscal</div></div>
      </div>

      <VehicleForm initial={{
        plate: vehicle.plate,
        vehicleType: vehicle.vehicle_type ?? "Carro",
        brandModel: vehicle.brand_model ?? "",
        color: vehicle.color ?? "",
        companyName: vehicle.company_name ?? "",
        fleetPrefix: vehicle.fleet_prefix ?? "",
        routeName: vehicle.route_name ?? "",
        notes: vehicle.notes ?? "",
        active: vehicle.active,
      }} />


      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-heading"><h2>Autorizações de circulação</h2><Link className="table-action" href="/admin/autorizacoes/novo">Cadastrar nova</Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serviço</th><th>Empresa</th><th>Validade</th><th>Horário</th><th>Área</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(authorizations ?? []).map((authorization: any) => {
                const authStatus = authorizationStatus(authorization);
                return <tr key={authorization.id}>
                  <td>{authorization.service_types?.name ?? "—"}</td>
                  <td>{authorization.company_name}</td>
                  <td>{new Date(`${authorization.valid_from}T12:00:00`).toLocaleDateString("pt-BR")} → {new Date(`${authorization.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td>{authorization.permitted_start_time?.slice(0,5) ?? "Livre"} → {authorization.permitted_end_time?.slice(0,5) ?? "Livre"}</td>
                  <td className="address-cell">{authorization.allowed_area ?? "Sem restrição cadastrada"}</td>
                  <td><span className={`status-badge ${authorizationBadgeClass(authStatus)}`}>{authorizationStatusLabels[authStatus]}</span></td>
                  <td><Link className="table-action" href={`/admin/autorizacoes/${authorization.id}`}>Abrir</Link></td>
                </tr>;
              })}
              {(authorizations?.length ?? 0) === 0 && <tr><td colSpan={7} className="empty-state">Nenhuma autorização cadastrada para esta placa.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-heading"><h2>Histórico da placa</h2><span className="status-badge status-scheduled">{history?.length ?? 0} carregadas</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ocorrência</th><th>Data</th><th>Infração</th><th>Resultado</th><th>Equipe</th><th>Endereço</th><th>Observação</th></tr></thead>
            <tbody>
              {(history ?? []).map((item: any) => (
                <tr key={item.id}>
                  <td><Link className="table-action" href={`/admin/fiscalizacoes/${item.id}`}>{item.occurrence_number}</Link></td>
                  <td>{formatDateTime(item.captured_at)}</td>
                  <td>{item.infraction_types?.name ?? "Somente fiscalização"}</td>
                  <td>{enforcementLabel(item.enforcement_action)}</td>
                  <td>{item.teams?.name ?? "—"}</td>
                  <td className="address-cell">{item.address ?? "—"}</td>
                  <td className="address-cell">{item.notes ?? "—"}</td>
                </tr>
              ))}
              {(history?.length ?? 0) === 0 && <tr><td colSpan={7} className="empty-state">Sem fiscalizações.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
