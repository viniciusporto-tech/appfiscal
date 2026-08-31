"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, RotateCcw } from "lucide-react";

type Option = { id: string; name: string };
type Agent = { id: string; full_name: string; registration_number: string | null };
type Infraction = { id: string; name: string; category: string };

type Props = {
  teams: Option[];
  agents: Agent[];
  infractions: Infraction[];
  serviceTypes: Option[];
};

type ReportType = "inspections" | "vehicles";

type FieldDef = { key: string; label: string };

const INSPECTION_FIELDS: FieldDef[] = [
  { key: "occurrence", label: "Número da ocorrência" },
  { key: "captured_at", label: "Data / hora" },
  { key: "plate", label: "Placa" },
  { key: "vehicle_type", label: "Tipo do veículo" },
  { key: "brand_model", label: "Marca / modelo" },
  { key: "color", label: "Cor" },
  { key: "company_name", label: "Empresa / operador" },
  { key: "fleet_prefix", label: "Prefixo" },
  { key: "route_name", label: "Linha" },
  { key: "infraction", label: "Infração" },
  { key: "infraction_code", label: "Código da infração" },
  { key: "infraction_category", label: "Categoria da infração" },
  { key: "enforcement", label: "Resultado / multa" },
  { key: "team", label: "Equipe" },
  { key: "agent", label: "Agente" },
  { key: "registration", label: "Matrícula do agente" },
  { key: "address", label: "Endereço" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "gps_accuracy", label: "Precisão do GPS" },
  { key: "notes", label: "Observações" },
  { key: "photo_count", label: "Quantidade de fotos" },
  { key: "record_status", label: "Situação do registro" },
  { key: "created_at", label: "Data de gravação no sistema" },
];

const VEHICLE_FIELDS: FieldDef[] = [
  { key: "plate", label: "Placa" },
  { key: "vehicle_type", label: "Tipo do veículo" },
  { key: "brand_model", label: "Marca / modelo" },
  { key: "color", label: "Cor" },
  { key: "company_name", label: "Empresa / operador" },
  { key: "fleet_prefix", label: "Prefixo" },
  { key: "route_name", label: "Linha" },
  { key: "active", label: "Status do cadastro" },
  { key: "first_seen_at", label: "Primeira fiscalização" },
  { key: "last_seen_at", label: "Última fiscalização cadastrada" },
  { key: "inspection_count", label: "Fiscalizações no período" },
  { key: "infraction_count", label: "Infrações no período" },
  { key: "fine_count", label: "Multas no período" },
  { key: "last_inspection_at", label: "Última fiscalização no período" },
  { key: "last_infraction", label: "Última infração no período" },
  { key: "authorization_count", label: "Autorizações cadastradas" },
  { key: "valid_authorization_count", label: "Autorizações válidas" },
  { key: "authorization_status", label: "Situação das autorizações" },
  { key: "service_types", label: "Tipos de serviço autorizados" },
  { key: "notes", label: "Observações do veículo" },
];

const DEFAULT_INSPECTION_FIELDS = ["occurrence", "captured_at", "plate", "vehicle_type", "infraction", "enforcement", "team", "agent", "address"];
const DEFAULT_VEHICLE_FIELDS = ["plate", "vehicle_type", "company_name", "fleet_prefix", "inspection_count", "infraction_count", "fine_count", "last_inspection_at"];
const VEHICLE_TYPES = ["Carro", "Ônibus", "Van", "Táxi", "Moto", "Micro-ônibus", "Outro"];

function localDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toLocaleDateString("en-CA");
}

export function ReportBuilder({ teams, agents, infractions, serviceTypes }: Props) {
  const [reportType, setReportType] = useState<ReportType>("inspections");
  const [dateFrom, setDateFrom] = useState(localDate(30));
  const [dateTo, setDateTo] = useState(localDate());
  const [allDates, setAllDates] = useState(false);
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [teamId, setTeamId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [infractionId, setInfractionId] = useState("");
  const [enforcementAction, setEnforcementAction] = useState("");
  const [recordStatus, setRecordStatus] = useState("active");
  const [company, setCompany] = useState("");
  const [minInspections, setMinInspections] = useState("0");
  const [authorization, setAuthorization] = useState("all");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [fields, setFields] = useState<string[]>(DEFAULT_INSPECTION_FIELDS);

  const availableFields = reportType === "inspections" ? INSPECTION_FIELDS : VEHICLE_FIELDS;

  const selectedLabels = useMemo(
    () => availableFields.filter((field) => fields.includes(field.key)).map((field) => field.label),
    [availableFields, fields],
  );

  function changeType(type: ReportType) {
    setReportType(type);
    setFields(type === "inspections" ? DEFAULT_INSPECTION_FIELDS : DEFAULT_VEHICLE_FIELDS);
  }

  function toggleField(key: string) {
    setFields((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function resetFields() {
    setFields(reportType === "inspections" ? DEFAULT_INSPECTION_FIELDS : DEFAULT_VEHICLE_FIELDS);
  }

  function reportUrl(format: "xlsx" | "pdf" | "csv") {
    const params = new URLSearchParams({ reportType, format, fields: fields.join(",") });
    if (allDates) params.set("allDates", "1");
    else { params.set("dateFrom", dateFrom); params.set("dateTo", dateTo); }
    if (plate.trim()) params.set("plate", plate.trim().toUpperCase());
    if (vehicleType) params.set("vehicleType", vehicleType);
    if (infractionId) params.set("infractionId", infractionId);
    if (reportType === "inspections") {
      if (teamId) params.set("teamId", teamId);
      if (agentId) params.set("agentId", agentId);
      if (enforcementAction) params.set("enforcementAction", enforcementAction);
      params.set("recordStatus", recordStatus);
    } else {
      if (company.trim()) params.set("company", company.trim());
      if (Number(minInspections) > 0) params.set("minInspections", minInspections);
      params.set("authorization", authorization);
      if (serviceTypeId) params.set("serviceTypeId", serviceTypeId);
    }
    return `/api/admin/reports?${params.toString()}`;
  }

  return (
    <div className="report-builder-layout">
      <section className="card">
        <div className="section-heading">
          <div>
            <h2 style={{ margin: 0 }}>1. Escolha o relatório</h2>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Monte o arquivo com exatamente os dados que deseja.</p>
          </div>
        </div>

        <div className="report-type-grid">
          <button type="button" className={`report-type-card ${reportType === "inspections" ? "selected" : ""}`} onClick={() => changeType("inspections")}>
            <strong>Fiscalizações</strong>
            <span>Ocorrências, agentes, equipes, infrações, endereço, GPS e fotos.</span>
          </button>
          <button type="button" className={`report-type-card ${reportType === "vehicles" ? "selected" : ""}`} onClick={() => changeType("vehicles")}>
            <strong>Veículos</strong>
            <span>Cadastro, reincidência, multas, infrações e autorizações.</span>
          </button>
        </div>

        <h3>2. Filtros</h3>
        <div className="grid grid-3 report-filter-grid">
          <div className="field"><label className="label">Data inicial</label><input className="input" type="date" value={dateFrom} disabled={allDates} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="field"><label className="label">Data final</label><input className="input" type="date" value={dateTo} disabled={allDates} onChange={(e) => setDateTo(e.target.value)} /></div>
          <label className="checkbox-card"><input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} /><span>Usar todo o histórico</span></label>
          <div className="field"><label className="label">Placa contém</label><input className="input" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC1D23" /></div>
          <div className="field"><label className="label">Tipo de veículo</label><select className="select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}><option value="">Todos</option>{VEHICLE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="field"><label className="label">Infração</label><select className="select" value={infractionId} onChange={(e) => setInfractionId(e.target.value)}><option value="">Todas</option>{infractions.map((item) => <option key={item.id} value={item.id}>{item.category} — {item.name}</option>)}</select></div>

          {reportType === "inspections" ? (
            <>
              <div className="field"><label className="label">Equipe</label><select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Todas</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="field"><label className="label">Agente</label><select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)}><option value="">Todos</option>{agents.map((item) => <option key={item.id} value={item.id}>{item.full_name}{item.registration_number ? ` • ${item.registration_number}` : ""}</option>)}</select></div>
              <div className="field"><label className="label">Resultado</label><select className="select" value={enforcementAction} onChange={(e) => setEnforcementAction(e.target.value)}><option value="">Todos</option><option value="none">Não multado</option><option value="municipal_guard">Multado pela Guarda</option><option value="transport_inspector">Multado pelo Fiscal</option></select></div>
              <div className="field"><label className="label">Situação do registro</label><select className="select" value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)}><option value="active">Somente ativos</option><option value="cancelled">Somente cancelados</option><option value="all">Ativos + cancelados</option></select></div>
            </>
          ) : (
            <>
              <div className="field"><label className="label">Empresa / operador contém</label><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
              <div className="field"><label className="label">Mínimo de fiscalizações</label><input className="input" type="number" min="0" value={minInspections} onChange={(e) => setMinInspections(e.target.value)} /></div>
              <div className="field"><label className="label">Autorização</label><select className="select" value={authorization} onChange={(e) => setAuthorization(e.target.value)}><option value="all">Qualquer situação</option><option value="authorized">Com autorização cadastrada</option><option value="valid">Com autorização válida</option><option value="not_authorized">Sem autorização</option></select></div>
              <div className="field"><label className="label">Tipo de serviço autorizado</label><select className="select" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}><option value="">Todos</option>{serviceTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            </>
          )}
        </div>

        <div className="section-heading" style={{ marginTop: 8 }}>
          <div><h3 style={{ margin: 0 }}>3. Informações que entrarão no relatório</h3><p className="page-subtitle" style={{ marginBottom: 0 }}>{fields.length} coluna(s) selecionada(s).</p></div>
          <div className="table-actions">
            <button className="button button-ghost" type="button" onClick={() => setFields(availableFields.map((item) => item.key))}>Marcar tudo</button>
            <button className="button button-ghost" type="button" onClick={() => setFields([])}>Limpar</button>
            <button className="button button-secondary" type="button" onClick={resetFields}><RotateCcw size={16} /> Padrão</button>
          </div>
        </div>

        <div className="report-fields-grid">
          {availableFields.map((field) => (
            <label className={`checkbox-card ${fields.includes(field.key) ? "selected" : ""}`} key={field.key}>
              <input type="checkbox" checked={fields.includes(field.key)} onChange={() => toggleField(field.key)} />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </section>

      <aside className="card report-export-card">
        <div className="eyebrow">Prévia da seleção</div>
        <h2>{reportType === "inspections" ? "Relatório de fiscalizações" : "Relatório de veículos"}</h2>
        <p className="page-subtitle">{allDates ? "Todo o histórico" : `${dateFrom || "início"} até ${dateTo || "hoje"}`}</p>
        <div className="report-selected-fields">
          {selectedLabels.length ? selectedLabels.map((label) => <span key={label}>{label}</span>) : <span>Nenhuma coluna selecionada</span>}
        </div>
        {fields.length === 0 ? <div className="notice notice-error">Selecione pelo menos uma informação.</div> : null}
        <a className={`button ${fields.length === 0 ? "disabled-link" : ""}`} href={fields.length ? reportUrl("xlsx") : undefined}><FileSpreadsheet size={18} /> Gerar Excel</a>
        <a className={`button button-secondary ${fields.length === 0 ? "disabled-link" : ""}`} href={fields.length ? reportUrl("pdf") : undefined}><FileText size={18} /> Gerar PDF</a>
        <a className={`button button-ghost ${fields.length === 0 ? "disabled-link" : ""}`} href={fields.length ? reportUrl("csv") : undefined}><Download size={18} /> Gerar CSV</a>
      </aside>
    </div>
  );
}
