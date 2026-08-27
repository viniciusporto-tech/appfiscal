import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cria um cliente administrativo do Supabase que existe SOMENTE no servidor.
//
// IMPORTANTE:
// - Este cliente usa a chave service_role.
// - A service_role ignora as regras RLS do banco.
// - Por isso, este arquivo nunca deve ser importado por componentes com "use client".
export function createAdminClient() {
  // URL pública do projeto Supabase.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Chave administrativa privada usada apenas pelo servidor.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Interrompe com uma mensagem clara caso a configuração esteja incompleta.
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local.",
    );
  }

  // Retorna um cliente sem persistência de sessão.
  // Esse cliente é usado apenas para operações administrativas pontuais.
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
