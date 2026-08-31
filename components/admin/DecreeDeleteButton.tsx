"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botão isolado para excluir um PDF sem transformar toda a página em Client Component.
export function DecreeDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    // Confirmação simples para evitar exclusão acidental.
    const confirmed = window.confirm(`Excluir "${name}"?`);

    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/admin/decrees/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        window.alert(result.error ?? "Não foi possível excluir o decreto.");
        return;
      }

      router.refresh();
    } catch {
      window.alert("Falha de comunicação com o servidor.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      className="table-action danger-text"
      type="button"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? "Excluindo..." : "Excluir"}
    </button>
  );
}
