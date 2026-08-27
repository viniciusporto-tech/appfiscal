"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SHIFT_PERIOD_OPTIONS,
  type ShiftPeriod,
} from "@/lib/shifts/time";

// Equipe exibida no seletor de criação do plantão.
type TeamOption = {
  id: string;
  name: string;
};

// Agente disponível para escala e as equipes em que ele pode atuar.
type AgentOption = {
  id: string;
  fullName: string;
  registrationNumber: string;
  workHours: 12 | 24;
  teamIds: string[];
};

// Linha editável da escala.
type AssignmentRow = {
  localId: string;
  agentId: string;
  period: ShiftPeriod;
  notes: string;
};

// Valores existentes quando o formulário é aberto no modo de edição.
type InitialShiftValues = {
  id: string;
  serviceDate: string;
  teamId: string;
  teamName: string;
  notes: string;
  assignments: Array<{
    agentId: string;
    period: ShiftPeriod;
    notes: string;
  }>;
};

// Propriedades compartilhadas pelas telas de novo plantão e edição.
type ShiftFormProps = {
  teams: TeamOption[];
  agents: AgentOption[];
  defaultServiceDate: string;
  initialValues?: InitialShiftValues;
};

// Cria um identificador somente para controlar linhas no navegador.
function createLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

// Formulário principal de criação e manutenção das escalas.
export function ShiftForm({
  teams,
  agents,
  defaultServiceDate,
  initialValues,
}: ShiftFormProps) {
  // A presença de valores iniciais indica edição de um plantão existente.
  const editing = Boolean(initialValues);
  const router = useRouter();

  // Equipe e data ficam travadas durante a edição para preservar o histórico.
  const [serviceDate, setServiceDate] = useState(
    initialValues?.serviceDate ?? defaultServiceDate,
  );
  const [teamId, setTeamId] = useState(initialValues?.teamId ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");

  // Converte os vínculos existentes para linhas controladas no navegador.
  const [assignments, setAssignments] = useState<AssignmentRow[]>(
    initialValues?.assignments.map((assignment) => ({
      localId: createLocalId(),
      ...assignment,
    })) ?? [],
  );

  // Estado visual do salvamento.
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Nome da equipe atualmente escolhida, usado nos avisos do formulário.
  const selectedTeamName = useMemo(() => {
    if (editing) {
      return initialValues!.teamName;
    }

    return teams.find((team) => team.id === teamId)?.name ?? "";
  }, [editing, initialValues, teamId, teams]);

  // Inclui uma linha vazia para o administrador adicionar outro agente.
  function addAssignment() {
    setAssignments((current) => [
      ...current,
      {
        localId: createLocalId(),
        agentId: "",
        period: "day",
        notes: "",
      },
    ]);
  }

  // Atualiza somente um campo de uma linha específica.
  function updateAssignment(
    localId: string,
    field: "agentId" | "period" | "notes",
    value: string,
  ) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.localId === localId
          ? {
              ...assignment,
              [field]: field === "period" ? (value as ShiftPeriod) : value,
              // Ao mudar o período, limpamos o agente quando a jornada não for compatível.
              ...(field === "period" ? { agentId: "" } : {}),
            }
          : assignment,
      ),
    );
  }

  // Remove somente a linha visual; ao salvar uma edição, o servidor preserva a versão antiga no histórico.
  function removeAssignment(localId: string) {
    setAssignments((current) =>
      current.filter((assignment) => assignment.localId !== localId),
    );
  }

  // Retorna agentes vinculados à equipe atual e com jornada compatível com a linha.
  function getAgentsForRow(row: AssignmentRow): AgentOption[] {
    const expectedHours =
      SHIFT_PERIOD_OPTIONS.find((option) => option.value === row.period)?.hours ?? 12;

    return agents.filter(
      (agent) =>
        agent.teamIds.includes(teamId) && agent.workHours === expectedHours,
    );
  }

  // Envia o plantão ao endpoint seguro do servidor.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (!teamId) {
        throw new Error("Selecione a equipe do plantão.");
      }

      // Não permite linha incompleta antes de chamar a API.
      if (assignments.some((assignment) => !assignment.agentId)) {
        throw new Error("Selecione o agente em todas as linhas da escala.");
      }

      const endpoint = editing
        ? `/api/admin/shifts/${initialValues!.id}`
        : "/api/admin/shifts";

      const method = editing ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Data e equipe só são usadas na criação; o servidor ignora alterações históricas na edição.
          serviceDate,
          teamId,
          notes,
          assignments: assignments.map((assignment) => ({
            agentId: assignment.agentId,
            period: assignment.period,
            notes: assignment.notes,
          })),
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
        shiftId?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível salvar a escala.");
      }

      setMessageType("success");
      setMessage(result.message ?? "Escala salva com sucesso.");

      // Retorna para a listagem já atualizada.
      router.refresh();
      router.push("/admin/escalas");
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a escala.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card shift-form" onSubmit={handleSubmit}>
      <div className="form-section-title">Identificação do plantão</div>

      <div className="grid grid-2">
        <div className="field">
          <label className="label" htmlFor="serviceDate">
            Data de início do plantão
          </label>
          <input
            className="input"
            id="serviceDate"
            type="date"
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
            disabled={editing}
            required
          />
          <span className="field-help">
            O plantão sempre considera 07h desta data até 07h do dia seguinte.
          </span>
        </div>

        <div className="field">
          <label className="label" htmlFor="teamId">
            Equipe responsável
          </label>

          {editing ? (
            <input
              className="input"
              id="teamId"
              value={selectedTeamName}
              disabled
            />
          ) : (
            <select
              className="select"
              id="teamId"
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
                // Ao trocar de equipe, limpa a escala para evitar manter agentes de outra equipe.
                setAssignments([]);
              }}
              required
            >
              <option value="">Selecione...</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="notes">
          Observação do plantão
        </label>
        <textarea
          className="textarea"
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex.: Operação especial, reforço, troca de equipe..."
        />
      </div>

      <div className="shift-section-heading">
        <div>
          <div className="form-section-title" style={{ marginBottom: 5 }}>
            Agentes escalados
          </div>
          <p className="metric-label" style={{ margin: 0 }}>
            {teamId
              ? `Mostrando somente agentes vinculados à ${selectedTeamName}.`
              : "Selecione uma equipe antes de adicionar agentes."}
          </p>
        </div>

        <button
          className="button button-secondary"
          type="button"
          onClick={addAssignment}
          disabled={!teamId || saving}
        >
          + Adicionar agente
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="empty-state shift-empty-state">
          Nenhum agente adicionado. O plantão pode ser salvo vazio e preenchido depois.
        </div>
      ) : (
        <div className="assignment-list">
          {assignments.map((row, index) => {
            const availableAgents = getAgentsForRow(row);
            const selectedElsewhere = new Set(
              assignments
                .filter((item) => item.localId !== row.localId)
                .map((item) => item.agentId)
                .filter(Boolean),
            );

            return (
              <div className="assignment-card" key={row.localId}>
                <div className="assignment-card-header">
                  <strong>Agente {index + 1}</strong>
                  <button
                    className="table-action danger-text"
                    type="button"
                    onClick={() => removeAssignment(row.localId)}
                    disabled={saving}
                  >
                    Remover
                  </button>
                </div>

                <div className="grid grid-2">
                  <div className="field">
                    <label className="label" htmlFor={`period-${row.localId}`}>
                      Período
                    </label>
                    <select
                      className="select"
                      id={`period-${row.localId}`}
                      value={row.period}
                      onChange={(event) =>
                        updateAssignment(row.localId, "period", event.target.value)
                      }
                    >
                      {SHIFT_PERIOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} — {option.hours}h
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`agent-${row.localId}`}>
                      Agente
                    </label>
                    <select
                      className="select"
                      id={`agent-${row.localId}`}
                      value={row.agentId}
                      onChange={(event) =>
                        updateAssignment(row.localId, "agentId", event.target.value)
                      }
                      required
                    >
                      <option value="">Selecione...</option>
                      {availableAgents.map((agent) => (
                        <option
                          key={agent.id}
                          value={agent.id}
                          disabled={selectedElsewhere.has(agent.id)}
                        >
                          {agent.fullName} — {agent.registrationNumber} ({agent.workHours}h)
                        </option>
                      ))}
                    </select>
                    {availableAgents.length === 0 && (
                      <span className="field-help warning-text">
                        Não há agente ativo de {row.period === "full" ? "24h" : "12h"} vinculado a esta equipe.
                      </span>
                    )}
                  </div>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label" htmlFor={`notes-${row.localId}`}>
                    Observação deste agente (opcional)
                  </label>
                  <input
                    className="input"
                    id={`notes-${row.localId}`}
                    value={row.notes}
                    onChange={(event) =>
                      updateAssignment(row.localId, "notes", event.target.value)
                    }
                    placeholder="Ex.: cobertura, troca, reforço..."
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="notice">
          Ao salvar uma alteração, a composição anterior fica preservada no histórico como substituída.
          Equipe e data do plantão não são alteradas; para corrigir esses dados, cancele e crie um novo plantão.
        </div>
      )}

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
          onClick={() => router.push("/admin/escalas")}
          disabled={saving}
        >
          Cancelar
        </button>
        <button className="button" type="submit" disabled={saving}>
          {saving
            ? "Salvando..."
            : editing
              ? "Salvar escala"
              : "Criar plantão"}
        </button>
      </div>
    </form>
  );
}
