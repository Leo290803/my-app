import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // obrigatório
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const substituicao_id = Number(body?.substituicao_id);
    const observacao_admin = String(body?.observacao_admin ?? "").trim();

    if (!substituicao_id) {
      return NextResponse.json({ error: "substituicao_id inválido" }, { status: 400 });
    }

    // busca a substituição
    const { data: sub, error: subErr } = await supabase
      .from("substituicoes")
      .select("id, status")
      .eq("id", substituicao_id)
      .maybeSingle();

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 400 });
    }
    if (!sub) {
      return NextResponse.json({ error: "Substituição não encontrada" }, { status: 404 });
    }

const pendente = sub.status === "PENDENTE_APROVACAO" || sub.status === "PENDENTE";
if (!pendente) {
  return NextResponse.json({ error: "Substituição já analisada" }, { status: 400 });
}


    // rejeita
    const { error: updErr } = await supabase
      .from("substituicoes")
      .update({
        status: "REJEITADA",
        observacao_admin: observacao_admin || "Rejeitada pelo Admin.",
      })
      .eq("id", substituicao_id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
