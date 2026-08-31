"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enforcementLabel, isFined } from "@/lib/inspections/labels";
import { authorizationStatusLabels, type AuthorizationStatus } from "@/lib/authorizations/status";
import { normalizePlate } from "@/lib/utils/format";

export function VehicleSearch() {
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const normalized = normalizePlate(plate);

    try {
      const supabase = createClient();
      const [{ data: vehicle }, { data: historyRows, error: historyError }, { data: authorizationRows, error: authorizationError }] = await Promise.all([
        supabase.from("vehicles").select("*").eq("plate", normalized).maybeSingle(),
        supabase.rpc("vehicle_history_lookup", { p_plate: normalized }),
        supabase.rpc("vehicle_authorization_lookup", { p_plate: normalized }),
      ]);
      if (historyError) throw historyError;
      if (authorizationError) throw authorizationError;
      setResult(vehicle);
      setHistory(historyRows ?? []);
      setAuthorizations(authorizationRows ?? []);
      if (!vehicle) setMessage("Veículo não encontrado no banco.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na consulta.");
    } finally {
      setLoading(false);
    }
  }

  const notifications = history.filter((item) => item.infraction_name).length;
  const fines = history.filter((item) => isFined(item.enforcement_action)).length;

  return (
    <>
      <form className="card" onSubmit={submit}>
        <div className="search-row">
          <input className="input" value={plate} onChange={(e) => setPlate(normalizePlate(e.target.value))} placeholder="Digite a placa" required />
          <button className="button" disabled={loading}><Search size={18} /> {loading ? "Consultando..." : "Consultar"}</button>
        </div>
        {message && <div className="notice">{message}</div>}
      </form>

      {result && (
        <>
        {authorizations.length > 0 ? (
          <div className="card agent-content-card">
            <div className="section-heading"><h2>Autorização de circulação</h2></div>
            <div className="authorized-card-list compact-authorizations">
              {authorizations.map((authorization: any) => {
                const status = authorization.authorization_status as AuthorizationStatus;
                return (
                  <div className={`authorization-lookup authorization-${status}`} key={authorization.authorization_id}>
                    <div className="authorization-card-header">
                      <strong>{authorization.service_type_name ?? "Serviço autorizado"}</strong>
                      <span className={`status-badge ${status === "valid" ? "status-active" : status === "outside_hours" || status === "not_started" ? "status-scheduled" : "status-inactive"}`}>{authorizationStatusLabels[status] ?? status}</span>
                    </div>
                    <div className="detail-grid">
                      <div className="detail-item"><span>Empresa</span><strong>{authorization.company_name}</strong></div>
                      <div className="detail-item"><span>Validade</span><strong>{new Date(`${authorization.valid_from}T12:00:00`).toLocaleDateString("pt-BR")} → {new Date(`${authorization.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}</strong></div>
                      <div className="detail-item"><span>Horário</span><strong>{authorization.permitted_start_time?.slice(0, 5) ?? "Livre"} → {authorization.permitted_end_time?.slice(0, 5) ?? "Livre"}</strong></div>
                      <div className="detail-item"><span>Área permitida</span><strong>{authorization.allowed_area ?? "Sem restrição cadastrada"}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="notice notice-warning agent-content-card"><strong>Sem autorização cadastrada:</strong> não existe autorização de circulação vinculada a esta placa.</div>
        )}
        <div className="card agent-content-card">
          <div className="section-heading"><h2>{result.plate}</h2><span className="status-badge status-scheduled">{history.length} fiscalização(ões)</span></div>
          <div className="grid grid-3" style={{ marginBottom: 14 }}>
            <div className="detail-item"><span>Fiscalizações</span><strong>{history.length}</strong></div>
            <div className="detail-item"><span>Notificações</span><strong>{notifications}</strong></div>
            <div className="detail-item"><span>Multas</span><strong>{fines}</strong></div>
          </div>
          <div className="detail-grid">
            <div className="detail-item"><span>Tipo</span><strong>{result.vehicle_type ?? "—"}</strong></div>
            <div className="detail-item"><span>Empresa</span><strong>{result.company_name ?? "—"}</strong></div>
            <div className="detail-item"><span>Prefixo</span><strong>{result.fleet_prefix ?? "—"}</strong></div>
            <div className="detail-item"><span>Linha</span><strong>{result.route_name ?? "—"}</strong></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead><tr><th>Data</th><th>Infração</th><th>Resultado</th><th>Equipe</th><th>Endereço</th></tr></thead>
              <tbody>
                {history.map((item: any) => (
                  <tr key={item.occurrence_number}>
                    <td>{new Date(item.captured_at).toLocaleString("pt-BR")}</td>
                    <td>{item.infraction_name ?? "Somente fiscalização"}</td>
                    <td>{enforcementLabel(item.enforcement_action)}</td>
                    <td>{item.team_name ?? "—"}</td>
                    <td className="address-cell">{item.address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </>
  );
}
