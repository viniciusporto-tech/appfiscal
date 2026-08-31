"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type InitialTeam = { id: string; code: string; name: string; description: string; active: boolean };

export function TeamForm({ initial }: { initial?: InitialTeam }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/teams/${initial!.id}` : "/api/admin/teams", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, description, active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha ao salvar equipe.");
      router.push("/admin/equipes"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao salvar equipe."); }
    finally { setSaving(false); }
  }

  return <form className="card" onSubmit={submit}>
    <div className="grid grid-2">
      <div className="field"><label className="label">Código</label><input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BRAVO" required /></div>
      <div className="field"><label className="label">Nome</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Equipe Bravo" required /></div>
    </div>
    <div className="field"><label className="label">Descrição</label><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <div className="field"><label className="label">Status</label><select className="select" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></div>
    {message && <div className="notice notice-error">{message}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => router.back()}>Cancelar</button><button className="button" disabled={saving}>{saving ? "Salvando..." : "Salvar equipe"}</button></div>
  </form>;
}
