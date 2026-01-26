import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { substituicao_id } = await req.json();

    const { data: sub, error } = await supabase
      .from("substituicoes")
      .select("*")
      .eq("id", substituicao_id)
      .single();

    if (error || !sub) {
      return NextResponse.json({ error: "Substituição não encontrada" }, { status: 404 });
    }

    // aceita os dois jeitos pra não travar
    const pendente = sub.status === "PENDENTE" || sub.status === "PENDENTE_APROVACAO";
    if (!pendente) {
      return NextResponse.json({ error: "Substituição já analisada" }, { status: 400 });
    }

    // 1) checar se o atleta de saída realmente está na equipe
    const { data: saidaExiste, error: saidaErr } = await supabase
      .from("equipe_membros")
      .select("id")
      .eq("equipe_id", sub.equipe_id)
      .eq("atleta_id", sub.atleta_saida_id)
      .maybeSingle();

    if (saidaErr) return NextResponse.json({ error: saidaErr.message }, { status: 400 });

    if (!saidaExiste) {
      return NextResponse.json(
        { error: "Atleta de saída não está mais na equipe (talvez já tenha sido substituído)." },
        { status: 400 }
      );
    }

    // 2) checar se o atleta de entrada já está na equipe
    const { data: entradaJaExiste, error: entradaErr } = await supabase
      .from("equipe_membros")
      .select("id")
      .eq("equipe_id", sub.equipe_id)
      .eq("atleta_id", sub.atleta_entrada_id)
      .maybeSingle();

    if (entradaErr) return NextResponse.json({ error: entradaErr.message }, { status: 400 });

    // 3) remover o atleta de saída
    const { error: delErr } = await supabase
      .from("equipe_membros")
      .delete()
      .eq("equipe_id", sub.equipe_id)
      .eq("atleta_id", sub.atleta_saida_id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    // 4) só insere o atleta de entrada se ainda não existir
    if (!entradaJaExiste) {
      const { error: insErr } = await supabase.from("equipe_membros").insert({
        equipe_id: sub.equipe_id,
        atleta_id: sub.atleta_entrada_id,
      });

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    // 5) marca como APROVADA
    const { error: updErr } = await supabase
      .from("substituicoes")
      .update({
        status: "APROVADA",
        observacao_admin: "Aprovada e aplicada pelo sistema",
      })
      .eq("id", substituicao_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
