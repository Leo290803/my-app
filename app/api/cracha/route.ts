import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pdf } from "@react-pdf/renderer";
import { CrachaPDF } from "@/lib/crachaPdf";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const atletaId = Number(searchParams.get("atletaId"));

    if (!atletaId) {
      return NextResponse.json({ error: "Informe atletaId" }, { status: 400 });
    }

    const { data: atleta } = await supabase
      .from("atletas")
      .select("id, nome, sexo, data_nascimento, escola_id, municipio_id")
      .eq("id", atletaId)
      .maybeSingle();

    if (!atleta) {
      return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });
    }

    const { data: escola } = await supabase
      .from("escolas")
      .select("nome")
      .eq("id", atleta.escola_id)
      .maybeSingle();

    const { data: municipio } = await supabase
      .from("municipios")
      .select("nome")
      .eq("id", atleta.municipio_id)
      .maybeSingle();

    const { data: fotoDoc } = await supabase
      .from("documentos")
      .select("arquivo_url")
      .eq("tipo_pessoa", "ATLETA")
      .eq("pessoa_id", atleta.id)
      .eq("tipo_documento", "FOTO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // modalidades (consolidado)
    const nomes = new Set<string>();

    const ind = await supabase
      .from("inscricoes_individuais")
      .select("evento_modalidade_id")
      .eq("atleta_id", atleta.id);

    const indIds = (ind.data ?? []).map((i) => i.evento_modalidade_id);

    if (indIds.length) {
      const em = await supabase
        .from("evento_modalidades")
        .select("modalidades (nome)")
        .in("id", indIds);

      em.data?.forEach((r: any) => r.modalidades?.nome && nomes.add(r.modalidades.nome));
    }

    const mem = await supabase
      .from("equipe_membros")
      .select("equipe_id")
      .eq("atleta_id", atleta.id);

    const eqIds = (mem.data ?? []).map((m) => m.equipe_id);

    if (eqIds.length) {
      const eqs = await supabase
        .from("equipes")
        .select("evento_modalidade_id")
        .in("id", eqIds);

      const emIds = (eqs.data ?? []).map((e) => e.evento_modalidade_id);

      if (emIds.length) {
        const em = await supabase
          .from("evento_modalidades")
          .select("modalidades (nome)")
          .in("id", emIds);

        em.data?.forEach((r: any) => r.modalidades?.nome && nomes.add(r.modalidades.nome));
      }
    }

    const modalidadesTexto = Array.from(nomes).sort().join(" – ");

    const idade =
      new Date().getFullYear() - new Date(atleta.data_nascimento).getFullYear();

    const categoria = idade <= 14 ? "12–14" : "15–17";
    const naipe = atleta.sexo === "M" ? "Masculino" : "Feminino";

const doc: any = React.createElement(CrachaPDF, {
  nome: atleta.nome,
  escola: escola?.nome ?? "—",
  municipio: municipio?.nome ?? "—",
  categoria,
  naipe,
  fotoUrl: fotoDoc?.arquivo_url ?? null,
  modalidadesTexto,
});


    const blob = await (pdf(doc) as any).toBlob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cracha-${atleta.id}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao gerar crachá" },
      { status: 500 }
    );
  }
}
