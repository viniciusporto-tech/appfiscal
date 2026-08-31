"use client";

import { FormEvent, useState } from "react";
import { Plus, Save } from "lucide-react";

type ServiceType = { id: string; name: string; description: string | null; active: boolean };

export function ServiceTypeManager({ initial }: { initial: ServiceType[] }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/service-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, active: true }),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error ?? "Falha ao cadastrar tipo de serviço.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao cadastrar tipo de serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function update(item: ServiceType) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/service-types/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error ?? "Falha ao atualizar.");
      setMessage(data.message ?? "Atualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar.");
    }
  }

  return (
    <>
      <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
        <div className="section-heading"><h2>Novo tipo de serviço</h2></div>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Turismo, Fretamento, Escolar, Evento" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Descrição</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional" />
          </div>
        </div>
        <div className="form-actions"><button className="button" disabled={saving}><Plus size={18} /> {saving ? "Cadastrando..." : "Cadastrar tipo"}</button></div>
      </form>

      {message && <div className="notice">{message}</div>}

      <div className="card">
        <div className="section-heading"><h2>Tipos cadastrados</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Descrição</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td><input className="input compact-input" value={item.name} onChange={(e) => setItems((current) => current.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /></td>
                  <td><input className="input compact-input" value={item.description ?? ""} onChange={(e) => setItems((current) => current.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></td>
                  <td>
                    <select className="select compact-input" value={item.active ? "active" : "inactive"} onChange={(e) => setItems((current) => current.map((row, i) => i === index ? { ...row, active: e.target.value === "active" } : row))}>
                      <option value="active">Ativo</option><option value="inactive">Inativo</option>
                    </select>
                  </td>
                  <td><button className="button button-secondary" type="button" onClick={() => update(item)}><Save size={16} /> Salvar</button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="empty-state">Nenhum tipo de serviço cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
