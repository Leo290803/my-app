import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { Buffer } from "buffer";

export const runtime = "nodejs";

type RowView = {
  origem?: string | null;
  inscricao_id?: number | null;

  escola_id?: number | null;
  municipio_id?: number | null;

  atleta_id?: number | null;
  atleta_nome?: string | null;
  atleta_sexo?: string | null; // "M" | "F"
  data_nascimento?: string | null;

  evento_id?: number | null;
  evento_nome?: string | null;

  evento_modalidade_id?: number | null;

  categoria?: string | null; // "12-14" | "15-17"
  naipe?: string | null;     // "M" | "F"

  modalidade_id?: number | null;
  modalidade_nome?: string | null;
  modalidade_tipo?: string | null; // "INDIVIDUAL" | "COLETIVA"

  evento_prova_id?: number | null;
  prova_id?: number | null;
  prova_nome?: string | null;

  status_inscr?: string | null; // ATIVA, etc
};

function makeSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 9, marginBottom: 10, color: "#444" },

  box: { border: "1px solid #ddd", padding: 8, marginBottom: 10 },

  table: { border: "1px solid #ddd" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f3f3f3",
    borderBottom: "1px solid #ddd",
  },
  row: { flexDirection: "row", borderBottom: "1px solid #eee" },
  cell: { padding: 4 },

  cNome: { width: "24%" },
  cSexo: { width: "6%" },
  cEvento: { width: "22%" },
  cModal: { width: "16%" },
  cProva: { width: "16%" },
  cCat: { width: "6%" },
  cNaipe: { width: "6%" },
  cStatus: { width: "10%" },

  footer: { marginTop: 10, fontSize: 8, color: "#555" },
});

function ReportDoc(props: { rows: RowView[]; filtros: string; geradoEm: string }) {
  const { rows, filtros, geradoEm } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório de Inscrições</Text>
        <Text style={styles.subtitle}>Gerado em {geradoEm}</Text>

        <View style={styles.box}>
          <Text>Filtros: {filtros || "—"}</Text>
          <Text>Total de registros: {rows.length}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.cNome]}>Atleta</Text>
            <Text style={[styles.cell, styles.cSexo]}>Sexo</Text>
            <Text style={[styles.cell, styles.cEvento]}>Evento</Text>
            <Text style={[styles.cell, styles.cModal]}>Modalidade</Text>
            <Text style={[styles.cell, styles.cProva]}>Prova</Text>
            <Text style={[styles.cell, styles.cCat]}>Cat</Text>
            <Text style={[styles.cell, styles.cNaipe]}>Naipe</Text>
            <Text style={[styles.cell, styles.cStatus]}>Status</Text>
          </View>

          {rows.map((r, idx) => (
            <View key={idx} style={styles.row}>
              <Text style={[styles.cell, styles.cNome]}>{r.atleta_nome ?? ""}</Text>
              <Text style={[styles.cell, styles.cSexo]}>{r.atleta_sexo ?? ""}</Text>
              <Text style={[styles.cell, styles.cEvento]}>{r.evento_nome ?? ""}</Text>
              <Text style={[styles.cell, styles.cModal]}>{r.modalidade_nome ?? ""}</Text>
              <Text style={[styles.cell, styles.cProva]}>{r.prova_nome ?? ""}</Text>
              <Text style={[styles.cell, styles.cCat]}>{r.categoria ?? ""}</Text>
              <Text style={[styles.cell, styles.cNaipe]}>{r.naipe ?? ""}</Text>
              <Text style={[styles.cell, styles.cStatus]}>{r.status_inscr ?? ""}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Obs: Tipo={rows[0]?.modalidade_tipo ?? "—"} | Origem={rows[0]?.origem ?? "—"}
        </Text>
      </Page>
    </Document>
  );
}

export async function GET(req: Request) {
  try {
    const sb = makeSupabaseServer();
    const { searchParams } = new URL(req.url);

    const evento_id = searchParams.get("evento_id") || "";
    const municipio_id = searchParams.get("municipio_id") || "";
    const escola_id = searchParams.get("escola_id") || "";
    const modalidade_id = searchParams.get("modalidade_id") || "";

    const tipo = searchParams.get("tipo") || "";        // modalidade_tipo
    const categoria = searchParams.get("categoria") || "";
    const naipe = searchParams.get("naipe") || "";
    const status = searchParams.get("status") || "";    // status_inscr
    const prova_id = searchParams.get("prova_id") || ""; // opcional

    let q = sb.from("v_relatorio_inscricoes").select("*");

    if (evento_id) q = q.eq("evento_id", Number(evento_id));
    if (municipio_id) q = q.eq("municipio_id", Number(municipio_id));
    if (escola_id) q = q.eq("escola_id", Number(escola_id));
    if (modalidade_id) q = q.eq("modalidade_id", Number(modalidade_id));

    if (tipo) q = q.eq("modalidade_tipo", tipo);
    if (categoria) q = q.eq("categoria", categoria);
    if (naipe) q = q.eq("naipe", naipe);
    if (status) q = q.eq("status_inscr", status);
    if (prova_id) q = q.eq("prova_id", Number(prova_id));

    // ✅ agora ordena pelo nome correto
    const { data, error } = await q.order("atleta_nome", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as unknown as RowView[];

    const filtros = [
      evento_id ? `evento_id=${evento_id}` : "",
      municipio_id ? `municipio_id=${municipio_id}` : "",
      escola_id ? `escola_id=${escola_id}` : "",
      modalidade_id ? `modalidade_id=${modalidade_id}` : "",
      tipo ? `tipo=${tipo}` : "",
      categoria ? `categoria=${categoria}` : "",
      naipe ? `naipe=${naipe}` : "",
      status ? `status=${status}` : "",
      prova_id ? `prova_id=${prova_id}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const geradoEm = new Date().toLocaleString("pt-BR");

    const doc = <ReportDoc rows={rows} filtros={filtros} geradoEm={geradoEm} />;

    // ✅ compatível com typings
    const blob = await pdf(doc).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio_inscricoes_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erro desconhecido" },
      { status: 500 }
    );
  }
}