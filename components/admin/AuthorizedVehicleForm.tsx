"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { normalizePlate } from "@/lib/utils/format";

type ServiceType = { id: string; name: string; active: boolean };

type InitialAuthorization = {
  id?: string;
  plate: string;
  vehicleType: string;
  brandModel: string;
  color: string;
  fleetPrefix: string;
  companyName: string;
  serviceTypeId: string;
  validFrom: string;
  validUntil: string;
  permittedStartTime: string;
  permittedEndTime: string;
  allowedArea: string;
  notes: string;
  active: boolean;
};

const emptyInitial: InitialAuthorization = {
  plate: "",
  vehicleType: "Van",
  brandModel: "",
  color: "",
  fleetPrefix: "",
  companyName: "",
  serviceTypeId: "",
  validFrom: "",
  validUntil: "",
  permittedStartTime: "",
  permittedEndTime: "",
  allowedArea: "",
  notes: "",
  active: true,
};

export function AuthorizedVehicleForm({
  serviceTypes,
  initial,
}: {
  serviceTypes: ServiceType[];
  initial?: InitialAuthorization;
}) {
  const model = useMemo(() => ({ ...emptyInitial, ...initial }), [initial]);
  const [plate, setPlate] = useState(model.plate);
  const [vehicleType, setVehicleType] = useState(model.vehicleType);
  const [brandModel, setBrandModel] = useState(model.brandModel);
  const [color, setColor] = useState(model.color);
  const [fleetPrefix, setFleetPrefix] = useState(model.fleetPrefix);
  const [companyName, setCompanyName] = useState(model.companyName);
  const [serviceTypeId, setServiceTypeId] = useState(model.serviceTypeId);
  const [validFrom, setValidFrom] = useState(model.validFrom);
  const [validUntil, setValidUntil] = useState(model.validUntil);
  const [permittedStartTime, setPermittedStartTime] = useState(model.permittedStartTime);
  const [permittedEndTime, setPermittedEndTime] = useState(model.permittedEndTime);
  const [allowedArea, setAllowedArea] = useState(model.allowedArea);
  const [notes, setNotes] = useState(model.notes);
  const [active, setActive] = useState(model.active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        plate,
        vehicleType,
        brandModel,
        color,
        fleetPrefix,
        companyName,
        serviceTypeId,
        validFrom,
        validUntil,
        permittedStartTime,
        permittedEndTime,
        allowedArea,
        notes,
        active,
      };

      const endpoint = model.id ? `/api/admin/authorizations/${model.id}` : "/api/admin/authorizations";
      const response = await fetch(endpoint, {
        method: model.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar a autorização.");

      setMessage(data.message ?? "Autorização salva.");
      if (!model.id && data.id) window.location.href = `/admin/autorizacoes/${data.id}`;
      else window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar autorização.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="form-section-title">Veículo e empresa</div>
      <div className="grid grid-3">
        <div className="field">
          <label className="label">Placa</label>
          <input className="input" value={plate} onChange={(e) => setPlate(normalizePlate(e.target.value))} placeholder="ABC1D23" required />
        </div>
        <div className="field">
          <label className="label">Tipo de veículo</label>
          <select className="select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            <option>Van</option>
            <option>Ônibus</option>
            <option>Micro-ônibus</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Prefixo</label>
          <input className="input" value={fleetPrefix} onChange={(e) => setFleetPrefix(e.target.value)} placeholder="Ex.: 1204" />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="field">
          <label className="label">Empresa / responsável</label>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Marca / modelo</label>
          <input className="input" value={brandModel} onChange={(e) => setBrandModel(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Cor</label>
          <input className="input" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>

      <div className="form-section-title">Autorização de circulação</div>
      <div className="grid grid-3">
        <div className="field">
          <label className="label">Tipo de serviço</label>
          <select className="select" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} required>
            <option value="">Selecione...</option>
            {serviceTypes.filter((item) => item.active || item.id === model.serviceTypeId).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <span className="field-help">Cadastre novos tipos em Admin → Autorizações → Tipos de serviço.</span>
        </div>
        <div className="field">
          <label className="label">Início da autorização</label>
          <input className="input" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Término da autorização</label>
          <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label className="label">Horário permitido — início</label>
          <input className="input" type="time" value={permittedStartTime} onChange={(e) => setPermittedStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Horário permitido — fim</label>
          <input className="input" type="time" value={permittedEndTime} onChange={(e) => setPermittedEndTime(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label className="label">Local / área onde pode circular</label>
        <textarea className="textarea" value={allowedArea} onChange={(e) => setAllowedArea(e.target.value)} placeholder="Ex.: Orla do Centro, Praia do Forte, itinerário X → Y, pontos autorizados..." />
      </div>

      <div className="field">
        <label className="label">Observações da autorização</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições especiais, documento, número do processo, restrições..." />
      </div>

      <label className="team-checkbox" style={{ maxWidth: 340 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span><strong>Autorização ativa</strong><br /><span className="field-help">Desmarque para revogar sem apagar o histórico.</span></span>
      </label>

      {message && <div className={message.toLowerCase().includes("salv") || message.toLowerCase().includes("cadastr") ? "notice notice-success" : "notice notice-error"}>{message}</div>}

      <div className="form-actions">
        <Link className="button button-secondary" href="/admin/autorizacoes">Voltar</Link>
        <button className="button button-success" disabled={saving}><Save size={18} /> {saving ? "Salvando..." : "Salvar autorização"}</button>
      </div>
    </form>
  );
}
