"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { createClient } from "@/lib/supabase/client";

// Tela de autenticação usada por agentes e administradores.
export default function LoginPage() {
  // Guarda o e-mail digitado pelo usuário.
  const [email, setEmail] = useState("");

  // Guarda a senha digitada pelo usuário.
  const [password, setPassword] = useState("");

  // Controla o estado visual durante o envio do formulário.
  const [loading, setLoading] = useState(false);

  // Guarda mensagens de erro para mostrar na própria página.
  const [errorMessage, setErrorMessage] = useState("");

  // Permite redirecionar o usuário depois do login.
  const router = useRouter();

  // Função executada quando o usuário toca em "Entrar".
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Evita o recarregamento tradicional do formulário.
    event.preventDefault();

    // Limpa mensagens antigas e mostra estado de carregamento.
    setErrorMessage("");
    setLoading(true);

    try {
      // Cria o cliente Supabase do navegador.
      const supabase = createClient();

      // Autentica usando e-mail e senha no Supabase Auth.
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      // Interrompe o fluxo caso o Supabase rejeite as credenciais.
      if (error) throw error;

      // Busca o perfil interno para descobrir se a pessoa é agente ou administrador.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // Interrompe se o usuário existe no Auth mas não possui perfil interno configurado.
      if (profileError || !profile) {
        throw new Error("Usuário autenticado, mas o perfil interno ainda não foi configurado.");
      }

      // Administradores entram no painel de gestão.
      if (profile.role === "admin") {
        router.push("/admin");
        return;
      }

      // Todos os demais perfis autorizados entram na área do agente.
      router.push("/agente");
    } catch (error) {
      // Transforma erros desconhecidos em uma mensagem amigável.
      const message = error instanceof Error ? error.message : "Não foi possível entrar no sistema.";
      setErrorMessage(message);
    } finally {
      // Remove o estado de carregamento em qualquer resultado.
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      {/* Registra os recursos da PWA quando a página é aberta no celular. */}
      <ServiceWorkerRegister />

      <section className="login-card">
        <div className="login-brand">
          <strong>Fiscalização Cabo Frio</strong>
          <span>Sistema interno de registro de fiscalizações</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="email">E-mail</label>
            <input
              className="input"
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Senha</label>
            <input
              className="input"
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage && <div className="notice notice-error">{errorMessage}</div>}

          <button className="button" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
