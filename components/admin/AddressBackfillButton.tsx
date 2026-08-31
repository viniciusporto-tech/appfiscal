"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

export function AddressBackfillButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/inspections/backfill-addresses", { method: "POST" });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error ?? "Falha ao preencher endereços.");
      setMessage(data.remaining ? `${data.message} Ainda faltam ${data.remainingCount}; clique novamente para continuar.` : data.message);
      if (!data.remaining) window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao preencher endereços.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button button-secondary" type="button" onClick={run} disabled={loading}>
        <MapPin size={18} /> {loading ? "Buscando endereços..." : "Preencher endereços antigos"}
      </button>
      {message && <div className="field-help" style={{ marginTop: 7, maxWidth: 420 }}>{message}</div>}
    </div>
  );
}
