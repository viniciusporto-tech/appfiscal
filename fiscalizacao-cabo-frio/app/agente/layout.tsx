import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Protege todas as páginas abaixo de /agente.
export default async function AgentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Cria o cliente Supabase do servidor para validar a sessão.
  const supabase = await createClient();

  // Busca o usuário real no Supabase Auth; não confia apenas em dados enviados pelo navegador.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Usuário sem sessão válida volta ao login.
  if (!user) {
    redirect("/login");
  }

  // Busca o perfil interno para verificar se o acesso está ativo.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  // Perfil inexistente ou desativado não entra na área operacional.
  if (!profile || profile.status !== "active") {
    redirect("/login");
  }

  // Renderiza a página solicitada depois das validações.
  return children;
}
