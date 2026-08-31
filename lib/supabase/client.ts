import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase usado em componentes que rodam no navegador.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Configure as variáveis públicas do Supabase no .env.local.");
  }

  return createBrowserClient(url, publishableKey);
}
