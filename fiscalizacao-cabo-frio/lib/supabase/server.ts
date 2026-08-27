import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cria um cliente Supabase para páginas e funções que executam no servidor do Next.js.
export async function createClient() {
  // Lê a URL pública configurada no ambiente da aplicação.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Lê a chave pública do Supabase.
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Falha de forma clara se o projeto ainda não foi conectado ao Supabase.
  if (!url || !publishableKey) {
    throw new Error("Configure as variáveis públicas do Supabase no arquivo .env.local.");
  }

  // Obtém o armazenamento de cookies da requisição atual.
  const cookieStore = await cookies();

  // Cria o cliente SSR que compartilha a sessão entre navegador e servidor.
  return createServerClient(url, publishableKey, {
    cookies: {
      // Entrega todos os cookies atuais para o Supabase localizar a sessão.
      getAll() {
        return cookieStore.getAll();
      },

      // Atualiza cookies quando o Supabase renovar tokens.
      setAll(cookiesToSet) {
        try {
          // Grava cada cookie usando as opções de segurança recebidas do Supabase.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components somente de leitura podem impedir escrita direta em cookies.
          // O arquivo proxy.ts também renova a sessão e cuida dessa atualização.
        }
      },
    },
  });
}
