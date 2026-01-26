import React from "react";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pdf, Document, Page } from "@react-pdf/renderer";
import { CrachaPDF } from "@/lib/crachaPdf";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const atletaIds: number[] = body.atletaIds;

    if (!Array.isArray(atletaIds) || atletaIds.length === 0) {
      return NextResponse.json({ error: "Informe atletaIds" }, { status: 400 });
    }

    const { data: atletas, error: aErr } = await supabase
      .from("atletas")
      .select("id, nome, sexo, data_nascimento, escola_id, municipio_id")
      .in("id", atletaIds);

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });
    if (!atletas || atletas.length === 0) {
      return NextResponse.json({ error: "Nenhum atleta encontrado" }, { status: 404 });
    }

    const pages: any[] = [];

    for (const atleta of atletas as any[]) {
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

      const { data: foto } = await supabase
        .from("documentos")
        .select("arquivo_url")
        .eq("tipo_pessoa", "ATLETA")
        .eq("pessoa_id", atleta.id)
        .eq("tipo_documento", "FOTO")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // modalidades consolidadas
      const nomes = new Set<string>();

      const ind = await supabase
        .from("inscricoes_individuais")
        .select("evento_modalidade_id")
        .eq("atleta_id", atleta.id);

      const indIds = (ind.data ?? []).map((i: any) => i.evento_modalidade_id);
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

      const eqIds = (mem.data ?? []).map((m: any) => m.equipe_id);
      if (eqIds.length) {
        const eqs = await supabase
          .from("equipes")
          .select("evento_modalidade_id")
          .in("id", eqIds);

        const emIds = (eqs.data ?? []).map((e: any) => e.evento_modalidade_id);
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

      pages.push(
        React.createElement(
          Page,
          { key: atleta.id, size: "A4", style: { padding: 16 } } as any,
          React.createElement(CrachaPDF as any, {
            nome: atleta.nome,
            escola: escola?.nome ?? "—",
            municipio: municipio?.nome ?? "—",
            categoria,
            naipe,
            fotoUrl: foto?.arquivo_url ?? null,
            modalidadesTexto,
          })
        )
      );
    }

    const doc: any = React.createElement(Document as any, null, pages as any);

    const blob = await (pdf(doc) as any).toBlob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="crachas-lote.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao gerar crachás em lote" },
      { status: 500 }
    );
  }
}
