import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { validateAgentInput } from "@/lib/agents/validation";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/agents
// Cria login, perfil interno e vínculos de equipe em uma única operação administrativa.
export async function POST(request: Request) {
  try {
    // Confirma que quem chamou esta rota é um administrador autenticado e ativo.
    const administrator = await requireAdmin();

    // Lê o JSON enviado pelo formulário do painel.
    const body = await request.json();

    // Valida os dados e exige senha no primeiro cadastro.
    const validation = validateAgentInput(body, { passwordRequired: true });

    // Interrompe cedo quando algum campo obrigatório estiver incorreto.
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 },
      );
    }

    // Dados já limpos e normalizados.
    const agent = validation.data;

    // Cria o cliente administrativo no servidor.
    const adminSupabase = createAdminClient();

    // Confirma se todos os IDs de equipe realmente existem no banco.
    if (agent.teamIds.length > 0) {
      const { data: validTeams, error: teamsError } = await adminSupabase
        .from("teams")
        .select("id")
        .in("id", agent.teamIds);

      if (teamsError || (validTeams?.length ?? 0) !== agent.teamIds.length) {
        return NextResponse.json(
          { error: "Uma das equipes selecionadas não existe." },
          { status: 400 },
        );
      }
    }

    // Cria o usuário de autenticação com e-mail já confirmado para uso interno.
    const { data: createdAuth, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: agent.email,
        password: agent.password!,
        email_confirm: true,
      });

    // Erros de e-mail duplicado ou senha inválida chegam por aqui.
    if (authError || !createdAuth.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Não foi possível criar o login do agente." },
        { status: 400 },
      );
    }

    // Guarda o ID criado para permitir rollback caso o cadastro interno falhe.
    const newUserId = createdAuth.user.id;

    // Insere os dados funcionais do agente na tabela profiles.
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .insert({
        id: newUserId,
        registration_number: agent.registrationNumber,
        full_name: agent.fullName,
        role: "agent",
        work_hours: agent.workHours,
        status: agent.status,
      });

    // Se a matrícula estiver duplicada ou ocorrer outro erro, remove o login criado para não deixar cadastro incompleto.
    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 },
      );
    }

    // Cria os vínculos de equipe informados no formulário.
    if (agent.teamIds.length > 0) {
      const { error: teamLinkError } = await adminSupabase
        .from("agent_teams")
        .insert(
          agent.teamIds.map((teamId, index) => ({
            agent_id: newUserId,
            team_id: teamId,
            // A primeira equipe marcada fica como principal apenas para referência administrativa.
            is_primary: index === 0,
          })),
        );

      // Em caso de falha nesta etapa, remove perfil e login para manter consistência.
      if (teamLinkError) {
        await adminSupabase.from("profiles").delete().eq("id", newUserId);
        await adminSupabase.auth.admin.deleteUser(newUserId);

        return NextResponse.json(
          { error: teamLinkError.message },
          { status: 400 },
        );
      }
    }

    // Registra a criação no histórico de auditoria.
    // Falha no log não desfaz o cadastro principal.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "agent.created",
      entity_type: "profiles",
      entity_id: newUserId,
      details: {
        full_name: agent.fullName,
        registration_number: agent.registrationNumber,
        team_ids: agent.teamIds,
      },
    });

    // Retorna sucesso para o formulário atualizar a tela.
    return NextResponse.json(
      {
        message: "Agente cadastrado com sucesso.",
        agentId: newUserId,
      },
      { status: 201 },
    );
  } catch (error) {
    // Traduz falhas de autorização para os códigos HTTP corretos.
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Evita expor detalhes sensíveis em erros inesperados.
    console.error("Erro ao cadastrar agente:", error);
    return NextResponse.json(
      { error: "Erro interno ao cadastrar o agente." },
      { status: 500 },
    );
  }
}
