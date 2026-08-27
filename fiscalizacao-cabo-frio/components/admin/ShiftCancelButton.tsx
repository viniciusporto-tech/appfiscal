"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botão isolado porque o cancelamento é uma ação interativa executada no navegador.
export function ShiftCancelButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function cancelShift() {
    // Confirma a ação porque o plantão ficará apenas como histórico depois disso.
    const confirmed = window.confirm(
      "Cancelar este plantão? Ele continuará no histórico, mas deixará de valer como escala ativa.",
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/shifts/${shiftId}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível cancelar o plantão.");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar o plantão.",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="inline-action-group">
      <button
        className="table-action danger-text"
        type="button"
        onClick={cancelShift}
        disabled={cancelling}
      >
        {cancelling ? "Cancelando..." : "Cancelar plantão"}
      </button>
      {errorMessage && <span className="inline-error">{errorMessage}</span>}
    </div>
  );
}
