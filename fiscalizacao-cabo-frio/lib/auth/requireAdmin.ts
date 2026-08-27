import "server-only";

import { createClient } from "@/lib/supabase/server";

// Estrutura mínima retornada após confirmar que a requisição pertence a um administrador.
export type AuthenticatedAdmin = {
  id: string;
  email: string | null;
};

// Confirma a sessão atual e garante que o usuário possui perfil administrativo ativo.
// Esta função deve ser chamada antes de qualquer operação sensível do painel.
export async function requireAdmin(): Promise<AuthenticatedAdmin> {
  // Usa o cliente SSR porque ele conhece os cookies da sessão atual.
  const supabase = await createClient();

  // Pergunta ao Supabase Auth quem é o usuário autenticado nesta requisição.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Sem usuário válido, a requisição não pode executar ações administrativas.
  if (userError || !user) {
    throw new Error("UNAUTHORIZED");
  }

  // Consulta o perfil interno para confirmar função e status.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  // Apenas administrador ativo passa pela verificação.
  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.status !== "active"
  ) {
    throw new Error("FORBIDDEN");
  }

  // Retorna somente os dados necessários para auditoria da ação.
  return {
    id: user.id,
    email: user.email ?? null,
  };
}
