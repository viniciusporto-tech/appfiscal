import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

// Limite simples para impedir uploads gigantes por engano.
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB.

// POST /api/admin/decrees
// Recebe nome + PDF e grava o arquivo no Storage privado do Supabase.
export async function POST(request: Request) {
  try {
    // Somente administrador ativo pode cadastrar documentos.
    const administrator = await requireAdmin();

    // FormData é necessário porque a requisição contém um arquivo PDF.
    const formData = await request.formData();

    // Lê e limpa o nome informado pelo administrador.
    const name = String(formData.get("name") ?? "").trim();

    // Recupera o arquivo enviado pelo formulário.
    const file = formData.get("file");

    // Nome é obrigatório e deve ser curto o suficiente para a interface.
    if (!name || name.length > 120) {
      return NextResponse.json(
        { error: "Informe um nome para o decreto com até 120 caracteres." },
        { status: 400 },
      );
    }

    // Confirma que realmente recebemos um arquivo.
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecione um arquivo PDF." },
        { status: 400 },
      );
    }

    // Aceita somente PDF.
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "O arquivo precisa estar no formato PDF." },
        { status: 400 },
      );
    }

    // Evita consumo excessivo de armazenamento por um único arquivo.
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "O PDF deve ter no máximo 20 MB." },
        { status: 400 },
      );
    }

    // Cria o cliente com chave administrativa somente no servidor.
    const adminSupabase = createAdminClient();

    // Gera um nome técnico único. O agente nunca verá este nome.
    const storagePath = `${Date.now()}-${crypto.randomUUID()}.pdf`;

    // Converte o File recebido em ArrayBuffer para enviar ao Storage.
    const fileBuffer = await file.arrayBuffer();

    // Envia o PDF para o bucket privado "decrees".
    const { error: uploadError } = await adminSupabase.storage
      .from("decrees")
      .upload(storagePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Não foi possível enviar o PDF: ${uploadError.message}` },
        { status: 400 },
      );
    }

    // Depois do upload, cria o registro que será exibido no sistema.
    const { data: decree, error: insertError } = await adminSupabase
      .from("decrees")
      .insert({
        name,
        storage_path: storagePath,
        active: true,
        created_by: administrator.id,
      })
      .select("id")
      .single();

    // Se o banco falhar, remove o arquivo para não deixar PDF órfão no Storage.
    if (insertError || !decree) {
      await adminSupabase.storage.from("decrees").remove([storagePath]);

      return NextResponse.json(
        { error: insertError?.message ?? "Não foi possível cadastrar o decreto." },
        { status: 400 },
      );
    }

    // Registra a ação para auditoria administrativa.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "decree.created",
      entity_type: "decrees",
      entity_id: decree.id,
      details: { name, storage_path: storagePath },
    });

    return NextResponse.json(
      { message: "Decreto cadastrado com sucesso." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("Erro ao cadastrar decreto:", error);
    return NextResponse.json(
      { error: "Erro interno ao cadastrar o decreto." },
      { status: 500 },
    );
  }
}
