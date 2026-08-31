"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export type TeamMembership = {
  teamId: string;
  period: "day" | "night" | "full";
};

type TeamOption = { id: string; name: string };
type InitialAgent = {
  id: string;
  fullName: string;
  registrationNumber: string;
  phone: string;
  email: string;
  workHours: 12 | 24;
  status: "active" | "inactive";
  memberships: TeamMembership[];
};

export function AgentForm({ teams, initial }: { teams: TeamOption[]; initial?: InitialAgent }) {
  const editing = Boolean(initial);
  const router = useRouter();
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [workHours, setWorkHours] = useState<12 | 24>(initial?.workHours ?? 24);
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "active");
  const [memberships, setMemberships] = useState<TeamMembership[]>(initial?.memberships ?? []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function isSelected(teamId: string) {
    return memberships.some((item) => item.teamId === teamId);
  }

  function toggleTeam(teamId: string) {
    setMemberships((current) => {
      if (current.some((item) => item.teamId === teamId)) {
        return current.filter((item) => item.teamId !== teamId);
      }
      return [...current, { teamId, period: workHours === 24 ? "full" : "day" }];
    });
  }

  function setPeriod(teamId: string, period: TeamMembership["period"]) {
    setMemberships((current) => current.map((item) => item.teamId === teamId ? { ...item, period } : item));
  }

  function changeWorkHours(value: 12 | 24) {
    setWorkHours(value);
    setMemberships((current) => current.map((item) => ({
      ...item,
      period: value === 24 ? "full" : item.period === "full" ? "day" : item.period,
    })));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/agents/${initial!.id}` : "/api/admin/agents", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, registrationNumber, phone, email, password, workHours, status, memberships }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar o agente.");
      router.push("/admin/agentes");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar agente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="form-section-title">Dados do agente</div>
      <div className="grid grid-2">
        <div className="field"><label className="label">Nome completo</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        <div className="field"><label className="label">Matrícula</label><input className="input" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required /></div>
        <div className="field"><label className="label">E-mail de acesso</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label className="label">Telefone (opcional)</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="field"><label className="label">{editing ? "Nova senha (opcional)" : "Senha temporária"}</label><input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required={!editing} /></div>
        <div className="field"><label className="label">Jornada</label><select className="select" value={workHours} onChange={(e) => changeWorkHours(Number(e.target.value) as 12 | 24)}><option value={12}>12 horas</option><option value={24}>24 horas</option></select></div>
        <div className="field"><label className="label">Status</label><select className="select" value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></div>
      </div>

      <div className="form-section-title">Equipes e período padrão</div>
      <div className="notice">O período padrão é usado quando você gerar a escala 24×72 em lote. Agente de 24h entra como 07h–07h; agente de 12h pode ser diurno ou noturno em cada equipe.</div>
      <div className="team-checkbox-grid">
        {teams.map((team) => {
          const membership = memberships.find((item) => item.teamId === team.id);
          return (
            <div className="team-checkbox" key={team.id}>
              <input type="checkbox" checked={isSelected(team.id)} onChange={() => toggleTeam(team.id)} />
              <div style={{ flex: 1 }}><strong>{team.name}</strong></div>
              {membership && (
                <select className="select" style={{ width: 155 }} value={membership.period} onChange={(e) => setPeriod(team.id, e.target.value as TeamMembership["period"])} disabled={workHours === 24}>
                  {workHours === 24 ? <option value="full">07h–07h</option> : <><option value="day">07h–19h</option><option value="night">19h–07h</option></>}
                </select>
              )}
            </div>
          );
        })}
      </div>
      {message && <div className="notice notice-error">{message}</div>}
      <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => router.back()}>Cancelar</button><button className="button" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar agente"}</button></div>
    </form>
  );
}
