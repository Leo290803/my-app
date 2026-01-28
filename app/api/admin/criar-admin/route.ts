import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

function getAnoFromISODate(iso: string) {
  const ano = (iso ?? "").slice(0, 4);
  return /^\d{4}$/.test(ano) ? ano : null;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ error: "Sem token (não autenticado)." }, { status: 401 });
    }

    const body = await req.json();
    const { cpf, nome, data_nascimento } = body as {
      cpf: string;
      nome: string;
      data_nascimento: string; // YYYY-MM-DD
    };

    const cpfLimpo = onlyDigits(cpf);

    if (!cpfLimpo || cpfLimpo.length !== 11 || !nome?.trim() || !data_nascimento) {
      return NextResponse.json(
        { error: "cpf, nome e data_nascimento são obrigatórios." },
        { status: 400 }
      );
    }

    const ano = getAnoFromISODate(data_nascimento);
    if (!ano) {
      return NextResponse.json({ error: "data_nascimento inválida (use YYYY-MM-DD)." }, { status: 400 });
    }

    // valida admin chamador
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

    // service role
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "SERVICE_ROLE não configurada no servidor." }, { status: 500 });
    }

    const supaAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // evita duplicar CPF como ADMIN
    const { data: jaExiste, error: jaErr } = await supaAdmin
      .from("perfis")
      .select("user_id")
      .eq("tipo", "ADMIN")
      .eq("cpf", cpfLimpo)
      .limit(1);

    if (jaErr) return NextResponse.json({ error: "Erro verificando CPF: " + jaErr.message }, { status: 400 });
    if (jaExiste && jaExiste.length > 0) {
      return NextResponse.json({ error: "Já existe um ADMIN com este CPF." }, { status: 400 });
    }

    // regra login/senha igual a do gestor
    const last4 = cpfLimpo.slice(-4);
    const senhaInicial = `${ano}${last4}`;
    const loginCpf = cpfLimpo;

    // email interno pro Auth
    const email = `${cpfLimpo}@jers.local`;

    // cria user no auth
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

    // cria perfil ADMIN (sem escola/municipio)
    const { error: perfilErr } = await supaAdmin.from("perfis").insert({
      user_id: userId,
      tipo: "ADMIN",
      nome: nome.trim(),
      cpf: cpfLimpo,
      data_nascimento, // precisa existir a coluna
      ativo: true,
    });

    if (perfilErr) {
      return NextResponse.json({ error: "Erro criando perfil: " + perfilErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      loginCpf,
      senhaInicial,
      email, // interno
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}