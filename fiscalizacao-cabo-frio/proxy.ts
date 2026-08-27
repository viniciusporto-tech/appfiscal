import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// O Next.js executa esta função antes das rotas definidas no matcher abaixo.
export async function proxy(request: NextRequest) {
  // Delega a atualização/validação da sessão para um arquivo isolado e fácil de testar.
  return updateSession(request);
}

// Evita executar o Proxy para arquivos estáticos que não dependem de autenticação.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
