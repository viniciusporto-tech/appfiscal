import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { createClient } from "@/lib/supabase/server";

// Protege todas as páginas abaixo de /admin e exige perfil administrativo.
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Cria o cliente Supabase do lado do servidor.
  const supabase = await createClient();

  // Valida a identidade diretamente no serviço de autenticação.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bloqueia acesso quando não existe sessão válida.
  if (!user) {
    redirect("/login");
  }

  // Consulta função e situação do usuário no cadastro interno.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  // Usuário sem perfil ativo também é bloqueado.
  if (!profile || profile.status !== "active") {
    redirect("/login");
  }

  // Agente comum é redirecionado para a área operacional.
  if (profile.role !== "admin") {
    redirect("/agente");
  }

  // O menu fica no layout para aparecer automaticamente em todas as páginas administrativas.
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-content">{children}</main>
    </div>
  );
}
