import { createBrowserClient } from "@supabase/ssr";

// Cria o cliente Supabase usado exclusivamente em componentes que rodam no navegador.
export function createClient() {
  // Lê a URL pública do projeto definida no arquivo .env.local.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Lê a chave pública do Supabase. Ela é segura no navegador quando as políticas RLS estão corretas.
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Interrompe com uma mensagem clara caso as variáveis ainda não tenham sido configuradas.
  if (!url || !publishableKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local.");
  }

  // Retorna uma instância pronta para autenticação, banco e storage.
  return createBrowserClient(url, publishableKey);
}
