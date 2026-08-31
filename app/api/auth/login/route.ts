import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Informe o e-mail e a senha." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 403 });
    }

    if (profile.status !== "active") {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Seu usuário está inativo." }, { status: 403 });
    }

    return NextResponse.json({ success: true, role: profile.role });
  } catch (error) {
    console.error("Erro na API de login:", error);
    return NextResponse.json({ error: "Erro interno ao realizar login." }, { status: 500 });
  }
}
