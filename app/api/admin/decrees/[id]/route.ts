import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE /api/admin/decrees/:id
// Exclui o registro e o PDF físico do Storage.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Confirma que a ação foi solicitada por um administrador ativo.
    const administrator = await requireAdmin();

    // No Next.js atual, params é assíncrono em Route Handlers dinâmicos.
    const { id } = await context.params;

    const adminSupabase = createAdminClient();

    // Descobre qual arquivo pertence ao registro antes de apagá-lo.
    const { data: decree, error: findError } = await adminSupabase
      .from("decrees")
      .select("id, name, storage_path")
      .eq("id", id)
      .single();

    if (findError || !decree) {
      return NextResponse.json(
        { error: "Decreto não encontrado." },
        { status: 404 },
      );
    }

    // Remove primeiro o arquivo físico do bucket privado.
    const { error: storageError } = await adminSupabase.storage
      .from("decrees")
      .remove([decree.storage_path]);

    if (storageError) {
      return NextResponse.json(
        { error: `Não foi possível apagar o PDF: ${storageError.message}` },
        { status: 400 },
      );
    }

    // Depois remove o registro da tabela.
    const { error: deleteError } = await adminSupabase
      .from("decrees")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 },
      );
    }

    // Guarda no log quem excluiu e qual documento foi removido.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "decree.deleted",
      entity_type: "decrees",
      entity_id: id,
      details: { name: decree.name },
    });

    return NextResponse.json({ message: "Decreto excluído com sucesso." });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("Erro ao excluir decreto:", error);
    return NextResponse.json(
      { error: "Erro interno ao excluir o decreto." },
      { status: 500 },
    );
  }
}
