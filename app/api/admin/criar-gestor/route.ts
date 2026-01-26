import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // 1) Token do usuário logado (Admin) vindo do frontend
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Sem token (não autenticado)." }, { status: 401 });
    }

    const body = await req.json();
    const { cpf, nome, escola_id } = body as {
      cpf: string;
      nome: string;
      escola_id: number;
    };

    if (!cpf || !nome || !escola_id) {
      return NextResponse.json({ error: "cpf, nome e escola_id são obrigatórios." }, { status: 400 });
    }

    // 2) Cliente ANON (para verificar se quem chamou é ADMIN via RPC is_admin)
    const supaAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: isAdmin, error: adminErr } = await supaAnon.rpc("is_admin");
    if (adminErr) {
      return NextResponse.json({ error: "Erro ao validar admin: " + adminErr.message }, { status: 403 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso negado. Somente ADMIN." }, { status: 403 });
    }

    // 3) Cliente SERVICE ROLE (server only) para criar usuário no Auth
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "SERVICE_ROLE não configurada no servidor." }, { status: 500 });
    }

    const supaAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // 4) Criar usuário no Auth (email interno)
    const email = `${cpf}@jers.local`;
    const last4 = cpf.slice(-4);
    const senhaInicial = `Jers2026@${last4}`; // simples e prática (depois você muda a regra se quiser)

    const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
      email,
      password: senhaInicial,
      email_confirm: true,
    });

    if (createErr) {
      return NextResponse.json({ error: "Erro criando usuário: " + createErr.message }, { status: 400 });
    }

    const userId = created.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Usuário criado sem ID." }, { status: 500 });
    }

    // 5) Descobrir município pela escola (para facilitar relatórios)
    const { data: escola, error: escolaErr } = await supaAdmin
      .from("escolas")
      .select("municipio_id")
      .eq("id", escola_id)
      .maybeSingle();

    if (escolaErr || !escola?.municipio_id) {
      return NextResponse.json({ error: "Erro ao obter município da escola." }, { status: 400 });
    }

    // 6) Criar perfil GESTOR
    const { error: perfilErr } = await supaAdmin.from("perfis").insert({
      user_id: userId,
      tipo: "GESTOR",
      nome,
      cpf,
      escola_id,
      municipio_id: escola.municipio_id,
      ativo: true,
    });

    if (perfilErr) {
      return NextResponse.json({ error: "Erro criando perfil: " + perfilErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      email,
      senhaInicial, // você pode mostrar pro admin e depois o gestor troca
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
