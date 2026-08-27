"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Dados necessários para alterar somente o status sem abrir a tela de edição.
type AgentStatusButtonProps = {
  agent: {
    id: string;
    fullName: string;
    registrationNumber: string;
    email: string;
    workHours: 12 | 24;
    status: "active" | "inactive";
    teamIds: string[];
  };
};

// Botão rápido usado na tabela de agentes para ativar ou desativar acesso.
export function AgentStatusButton({ agent }: AgentStatusButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Inverte o status atual.
  const nextStatus = agent.status === "active" ? "inactive" : "active";

  // Texto mostrado ao administrador.
  const label = agent.status === "active" ? "Desativar" : "Ativar";

  async function handleClick() {
    // Confirma a desativação porque ela impede o agente de entrar no sistema.
    if (
      agent.status === "active" &&
      !window.confirm(`Desativar o acesso de ${agent.fullName}?`)
    ) {
      return;
    }

    setSaving(true);

    try {
      // Reaproveita o mesmo endpoint de edição enviando todos os dados atuais.
      const response = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: agent.fullName,
          registrationNumber: agent.registrationNumber,
          email: agent.email,
          password: "",
          workHours: agent.workHours,
          status: nextStatus,
          teamIds: agent.teamIds,
        }),
      });

      // Se o servidor rejeitar a alteração, exibe a mensagem recebida.
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Não foi possível alterar o status.");
      }

      // Recarrega os dados da tabela sem atualizar a página inteira manualmente.
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      className={`table-action ${agent.status === "active" ? "danger-text" : "success-text"}`}
      type="button"
      onClick={handleClick}
      disabled={saving}
    >
      {saving ? "Salvando..." : label}
    </button>
  );
}
