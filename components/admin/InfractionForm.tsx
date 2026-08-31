"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const VEHICLE_TYPES = ["Carro", "Ônibus", "Van", "Táxi", "Moto", "Micro-ônibus", "Outro"];

type Initial = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  legalBasis: string;
  severity: string;
  active: boolean;
  allowedVehicleTypes: string[];
};

export function InfractionForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Geral");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [legalBasis, setLegalBasis] = useState(initial?.legalBasis ?? "");
  const [severity, setSeverity] = useState(initial?.severity ?? "normal");
  const [active, setActive] = useState(initial?.active ?? true);
  const [allowedVehicleTypes, setAllowedVehicleTypes] = useState<string[]>(initial?.allowedVehicleTypes ?? []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function toggleVehicle(type: string) {
    setAllowedVehicleTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/infractions/${initial!.id}` : "/api/admin/infractions", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          category,
          description,
          legalBasis,
          severity,
          active,
          allowedVehicleTypes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha ao salvar infração.");
      router.push("/admin/infracoes");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="grid grid-2">
        <div className="field">
          <label className="label">Código interno</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EST-001" />
        </div>
        <div className="field">
          <label className="label">Nome da infração</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Categoria</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Trânsito / Transporte" required />
        </div>
        <div className="field">
          <label className="label">Gravidade</label>
          <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="leve">Leve</option>
            <option value="media">Média</option>
            <option value="grave">Grave</option>
            <option value="gravissima">Gravíssima</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label">Aplicar esta infração a</label>
        <div className="notice" style={{ marginBottom: 10 }}>
          {allowedVehicleTypes.length === 0
            ? "Todos os tipos de veículo. Marque abaixo se quiser restringir esta infração."
            : `Somente: ${allowedVehicleTypes.join(", ")}.`}
        </div>
        <div className="vehicle-type-checkboxes">
          {VEHICLE_TYPES.map((type) => (
            <label className="checkbox-card" key={type}>
              <input
                type="checkbox"
                checked={allowedVehicleTypes.includes(type)}
                onChange={() => toggleVehicle(type)}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
        <button type="button" className="button button-ghost" onClick={() => setAllowedVehicleTypes([])} style={{ marginTop: 10 }}>
          Usar para todos os veículos
        </button>
      </div>

      <div className="field">
        <label className="label">Descrição</label>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Base legal / observação normativa</label>
        <textarea className="textarea" value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Status</label>
        <select className="select" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
          <option value="active">Ativa</option>
          <option value="inactive">Inativa</option>
        </select>
      </div>

      {message && <div className="notice notice-error">{message}</div>}
      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={() => router.back()}>Cancelar</button>
        <button className="button" disabled={saving}>{saving ? "Salvando..." : "Salvar infração"}</button>
      </div>
    </form>
  );
}
