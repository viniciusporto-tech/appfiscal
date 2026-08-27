"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Equipe disponível para vínculo administrativo do agente.
type TeamOption = {
  id: string;
  name: string;
};

// Valores existentes quando o formulário é aberto no modo de edição.
type InitialAgentValues = {
  id: string;
  fullName: string;
  registrationNumber: string;
  email: string;
  workHours: 12 | 24;
  status: "active" | "inactive";
  teamIds: string[];
};

// Propriedades do componente reutilizável de cadastro/edição.
type AgentFormProps = {
  teams: TeamOption[];
  initialValues?: InitialAgentValues;
};

// Formulário compartilhado pelas telas "Novo agente" e "Editar agente".
export function AgentForm({ teams, initialValues }: AgentFormProps) {
  // O modo de edição é detectado pela presença de valores iniciais.
  const editing = Boolean(initialValues);

  // Router permite voltar à lista depois de salvar.
  const router = useRouter();

  // Estado dos campos principais.
  const [fullName, setFullName] = useState(initialValues?.fullName ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(
    initialValues?.registrationNumber ?? "",
  );
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [password, setPassword] = useState("");
  const [workHours, setWorkHours] = useState<12 | 24>(
    initialValues?.workHours ?? 12,
  );
  const [status, setStatus] = useState<"active" | "inactive">(
    initialValues?.status ?? "active",
  );
  const [teamIds, setTeamIds] = useState<string[]>(
    initialValues?.teamIds ?? [],
  );

  // Estado visual do envio.
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Texto do botão muda de acordo com o modo atual.
  const submitLabel = useMemo(
    () => (editing ? "Salvar alterações" : "Cadastrar agente"),
    [editing],
  );

  // Marca ou desmarca uma equipe na lista de vínculos possíveis.
  function toggleTeam(teamId: string) {
    setTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
  }

  // Envia os dados ao endpoint seguro do servidor.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      // O endpoint muda entre criação e edição.
      const endpoint = editing
        ? `/api/admin/agents/${initialValues!.id}`
        : "/api/admin/agents";

      // A criação usa POST e a edição usa PATCH.
      const method = editing ? "PATCH" : "POST";

      // Faz a requisição sem enviar nenhuma chave administrativa ao navegador.
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          registrationNumber,
          email,
          password,
          workHours,
          status,
          teamIds,
        }),
      });

      // Converte a resposta para JSON, inclusive em caso de erro.
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      // Mostra a mensagem retornada pelo servidor quando a operação falhar.
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível salvar o agente.");
      }

      // Mostra confirmação visual antes de atualizar a lista.
      setMessageType("success");
      setMessage(result.message ?? "Dados salvos com sucesso.");

      // Atualiza Server Components e retorna para a listagem.
      router.refresh();
      router.push("/admin/agentes");
    } catch (error) {
      // Converte qualquer falha em uma mensagem amigável no formulário.
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o agente.",
      );
    } finally {
      // Libera o botão mesmo quando ocorrer erro.
      setSaving(false);
    }
  }

  return (
    <form className="card agent-form" onSubmit={handleSubmit}>
      <div className="form-section-title">Dados do agente</div>

      <div className="grid grid-2">
        <div className="field">
          <label className="label" htmlFor="fullName">
            Nome completo
          </label>
          <input
            className="input"
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ex.: João da Silva"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="registrationNumber">
            Matrícula
          </label>
          <input
            className="input"
            id="registrationNumber"
            value={registrationNumber}
            onChange={(event) => setRegistrationNumber(event.target.value)}
            placeholder="Ex.: 12345"
            required
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label className="label" htmlFor="email">
            E-mail de acesso
          </label>
          <input
            className="input"
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="agente@fiscalizacao.local"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            {editing ? "Nova senha (opcional)" : "Senha temporária"}
          </label>
          <input
            className="input"
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={editing ? "Deixe vazio para manter" : "Mínimo de 8 caracteres"}
            required={!editing}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label className="label" htmlFor="workHours">
            Jornada
          </label>
          <select
            className="select"
            id="workHours"
            value={workHours}
            onChange={(event) => setWorkHours(Number(event.target.value) as 12 | 24)}
          >
            <option value={12}>12 horas</option>
            <option value={24}>24 horas</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            className="select"
            id="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "active" | "inactive")
            }
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div className="form-section-title">Equipes em que pode atuar</div>
      <p className="metric-label" style={{ marginTop: -6 }}>
        A equipe da fiscalização será definida pela escala do plantão, não apenas por este cadastro.
      </p>

      <div className="team-checkbox-grid">
        {teams.map((team) => (
          <label className="team-checkbox" key={team.id}>
            <input
              type="checkbox"
              checked={teamIds.includes(team.id)}
              onChange={() => toggleTeam(team.id)}
            />
            <span>{team.name}</span>
          </label>
        ))}
      </div>

      {message && (
        <div
          className={`notice ${
            messageType === "error" ? "notice-error" : "notice-success"
          }`}
        >
          {message}
        </div>
      )}

      <div className="form-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => router.push("/admin/agentes")}
          disabled={saving}
        >
          Cancelar
        </button>
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
