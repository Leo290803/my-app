import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function makeSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const sb = makeSupabaseServer();
    const { searchParams } = new URL(req.url);

    const evento_id = Number(searchParams.get("evento_id") || 0);
    const modalidade_id = Number(searchParams.get("modalidade_id") || 0);

    if (!evento_id) {
      return NextResponse.json({ error: "evento_id é obrigatório" }, { status: 400 });
    }

    // Vamos buscar da sua VIEW pra bater com o que você tem
    // (no print tem prova_id e prova_nome)
    let q = sb
      .from("v_relatorio_inscricoes")
      .select("prova_id, prova_nome")
      .eq("evento_id", evento_id)
      .not("prova_id", "is", null);

    // Se escolher modalidade, filtra também
    if (modalidade_id) q = q.eq("modalidade_id", modalidade_id);

    const { data, error } = await q;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // unique + ordenado
    const map = new Map<number, string>();
    (data ?? []).forEach((r: any) => {
      if (r?.prova_id) map.set(Number(r.prova_id), String(r.prova_nome ?? `Prova ${r.prova_id}`));
    });

    const provas = Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({ provas });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro desconhecido" }, { status: 500 });
  }
}