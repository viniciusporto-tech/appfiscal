import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Atualiza a sessão do Supabase antes que páginas protegidas sejam processadas.
export async function updateSession(request: NextRequest) {
  // Começa com uma resposta normal do Next.js para a mesma requisição.
  let response = NextResponse.next({ request });

  // Busca as variáveis públicas usadas para validar a sessão.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Enquanto o projeto ainda não estiver configurado, deixa rotas públicas carregarem normalmente.
  if (!url || !publishableKey) {
    return response;
  }

  // Cria um cliente Supabase específico para a camada Proxy.
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      // Entrega os cookies enviados pelo navegador.
      getAll() {
        return request.cookies.getAll();
      },

      // Copia cookies renovados tanto para a requisição quanto para a resposta.
      setAll(cookiesToSet) {
        // Atualiza os cookies que os Server Components verão nesta requisição.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        // Recria a resposta usando a requisição já atualizada.
        response = NextResponse.next({ request });

        // Envia os novos cookies ao navegador para as próximas requisições.
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Confirma a identidade diretamente com o Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verifica se a rota atual exige autenticação.
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/agente") ||
    request.nextUrl.pathname.startsWith("/admin");

  // Se alguém sem sessão tentar abrir área interna, redireciona para o login.
  if (isProtectedRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Mantém a navegação normal quando a sessão está válida ou a rota é pública.
  return response;
}
