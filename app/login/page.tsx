"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ServiceWorkerRegister } from "@/components/ui/ServiceWorkerRegister";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const responseText = await response.text();
      if (!responseText) throw new Error(`A API de login respondeu vazia. Código HTTP: ${response.status}`);

      let result: { error?: string; role?: string };
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`A API de login retornou uma resposta inválida. Código HTTP: ${response.status}`);
      }

      if (!response.ok) throw new Error(result.error ?? "Não foi possível entrar.");
      window.location.href = result.role === "admin" ? "/admin" : "/agente";
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <ServiceWorkerRegister />
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo"><ShieldCheck size={28} /></div>
          <div><strong>Fiscalização Cabo Frio</strong><span>Sistema interno de gestão e fiscalização</span></div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="email">E-mail</label>
            <input className="input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Senha</label>
            <input className="input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {errorMessage && <div className="notice notice-error">{errorMessage}</div>}
          <button className="button" type="submit" disabled={loading} style={{ width: "100%" }}>{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      </section>
    </main>
  );
}
