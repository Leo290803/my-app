"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Evento = { id: number; nome: string; municipio_id: number | null };
type Municipio = { id: number; nome: string };
type Escola = { id: number; nome: string; municipio_id: number };

type ProvaOpt = { id: number; nome: string };

type ModalidadeOpt = {
  evento_modalidade_id: number;
  modalidade_id: number;
  modalidade_nome: string;
  tipo: "INDIVIDUAL" | "COLETIVA";
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
};

type RowResumo = {
  evento_id: number;
  modalidade_id: number;
  modalidade_nome: string;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
  municipio_id: number;
  escola_id: number;
  tipo: "INDIVIDUAL" | "COLETIVA";
  status: string;
};

type RowDetalhe = {
  atleta_nome: string;
  atleta_id?: number | null;
  atleta_sexo?: string | null;

  evento_id: number;
  evento_nome: string;

  modalidade_id: number;
  modalidade_nome: string;
  modalidade_tipo: string; // INDIVIDUAL/COLETIVA

  categoria: string;
  naipe: string;

  prova_id?: number | null;
  prova_nome?: string | null;

  escola_id?: number | null;
  municipio_id?: number | null;

  status_inscr?: string | null; // ou status (depende da view)
  origem?: string | null;
};

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export default function AdminRelatoriosPage() {
  const [msg, setMsg] = useState("");

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  // filtros base
  const [fEventoId, setFEventoId] = useState<string>("");
  const [fMunicipioId, setFMunicipioId] = useState<string>("");
  const [fEscolaId, setFEscolaId] = useState<string>("");

  // filtros extra
  const [fTipo, setFTipo] = useState<string>("");
  const [fCategoria, setFCategoria] = useState<string>("");
  const [fNaipe, setFNaipe] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");

  // modalidade depende do evento
  const [modalidades, setModalidades] = useState<ModalidadeOpt[]>([]);
  const [fModalidadeId, setFModalidadeId] = useState<string>("");

  // ✅ provas (depende do evento e opcionalmente da modalidade)
  const [provas, setProvas] = useState<ProvaOpt[]>([]);
  const [fProvaId, setFProvaId] = useState<string>(""); // "" = Todas

  const [linhas, setLinhas] = useState<RowResumo[]>([]);

  const escolasFiltradas = useMemo(() => {
    const mid = Number(fMunicipioId);
    if (!mid) return escolas;
    return escolas.filter((e) => e.municipio_id === mid);
  }, [escolas, fMunicipioId]);

  function nomeMun(id: number) {
    return municipios.find((m) => m.id === id)?.nome ?? "—";
  }
  function nomeEscola(id: number) {
    return escolas.find((e) => e.id === id)?.nome ?? `Escola #${id}`;
  }

  async function carregarProvas(evId: number, modId?: number) {
    setProvas([]);
    setFProvaId(""); // volta pra "Todas"
    if (!evId) return;

    const qs = new URLSearchParams();
    qs.set("evento_id", String(evId));
    if (modId) qs.set("modalidade_id", String(modId));

    const res = await fetch(`/api/relatorios/provas?${qs.toString()}`);
    const json = await res.json();

    if (!res.ok) {
      setMsg("Erro ao carregar provas: " + (json?.error ?? "erro"));
      return;
    }

    setProvas(json.provas ?? []);
  }

  async function buscarDetalhado(): Promise<RowDetalhe[]> {
  let q = supabase.from("v_relatorio_inscricoes").select("*");

  const eid = Number(fEventoId);
  const mid = Number(fMunicipioId);
  const sid = Number(fEscolaId);
  const modId = Number(fModalidadeId);
  const pid = Number(fProvaId);

  if (eid) q = q.eq("evento_id", eid);
  if (mid) q = q.eq("municipio_id", mid);
  if (sid) q = q.eq("escola_id", sid);
  if (modId) q = q.eq("modalidade_id", modId);

  // ✅ prova (se escolher uma prova específica)
  if (pid) q = q.eq("prova_id", pid);

  // ✅ tipo (na tua view é modalidade_tipo)
  if (fTipo) q = q.eq("modalidade_tipo", fTipo);

  if (fCategoria) q = q.eq("categoria", fCategoria);
  if (fNaipe) q = q.eq("naipe", fNaipe);

  // ✅ status (na tua view parece ser status_inscr)
  if (fStatus) q = q.eq("status_inscr", fStatus);

  const { data, error } = await q.order("atleta_nome", { ascending: true });

  if (error) {
    setMsg("Erro relatório detalhado: " + error.message);
    return [];
  }
  return (data ?? []) as any;
}

  async function carregarFiltrosBase() {
    const ev = await supabase.from("eventos").select("id, nome, municipio_id").order("created_at", { ascending: false });
    if (ev.error) setMsg("Erro eventos: " + ev.error.message);
    setEventos((ev.data ?? []) as any);

    const m = await supabase.from("municipios").select("id, nome").order("nome");
    if (m.error) setMsg("Erro municípios: " + m.error.message);
    setMunicipios((m.data ?? []) as any);

    const e = await supabase.from("escolas").select("id, nome, municipio_id").order("nome");
    if (e.error) setMsg("Erro escolas: " + e.error.message);
    setEscolas((e.data ?? []) as any);
  }

  async function carregarModalidadesDoEvento(evId: number) {
    setModalidades([]);
    setFModalidadeId("");

    if (!evId) return;

    const { data, error } = await supabase
      .from("evento_modalidades")
      .select(
        `
        id, modalidade_id, categoria, naipe,
        modalidades ( id, nome, tipo )
      `
      )
      .eq("evento_id", evId)
      .order("id");

    if (error) {
      setMsg("Erro modalidades do evento: " + error.message);
      return;
    }

    const opts: ModalidadeOpt[] = (data ?? []).map((r: any) => ({
      evento_modalidade_id: Number(r.id),
      modalidade_id: Number(r.modalidade_id),
      modalidade_nome: r.modalidades?.nome ?? `Modalidade #${r.modalidade_id}`,
      tipo: (r.modalidades?.tipo ?? "INDIVIDUAL") as any,
      categoria: r.categoria,
      naipe: r.naipe,
    }));

    setModalidades(opts);
  }

  async function buscar() {
    setMsg("Carregando dashboard...");

    let q = supabase.from("v_inscricoes_resumo").select("*");

    const eid = Number(fEventoId);
    const mid = Number(fMunicipioId);
    const sid = Number(fEscolaId);
    const modId = Number(fModalidadeId);
    const pid = Number(fProvaId);

    if (eid) q = q.eq("evento_id", eid);
    if (mid) q = q.eq("municipio_id", mid);
    if (sid) q = q.eq("escola_id", sid);
    if (modId) q = q.eq("modalidade_id", modId);

    // ✅ se a sua view v_inscricoes_resumo também tem prova_id, filtra aqui.
    // Se não tiver, pode remover esta linha (ou criar a coluna na view).
    if (pid) q = q.eq("prova_id", pid);

    if (fTipo) q = q.eq("tipo", fTipo);
    if (fCategoria) q = q.eq("categoria", fCategoria);
    if (fNaipe) q = q.eq("naipe", fNaipe);
    if (fStatus) q = q.eq("status", fStatus);

    const { data, error } = await q;
    if (error) return setMsg("Erro: " + error.message);

    const rows = (data ?? []) as any as RowResumo[];
    setLinhas(rows);

    setMsg(`OK: ${(rows ?? []).length} inscrição(ões) no recorte`);
  }

  const totais = useMemo(() => {
    const total = linhas.length;

    const porMunicipio = new Map<number, number>();
    const porModalidade = new Map<string, number>();
    const porCategoria = new Map<string, number>();
    const porNaipe = new Map<string, number>();
    const porEscola = new Map<number, number>();

    for (const r of linhas) {
      porMunicipio.set(r.municipio_id, (porMunicipio.get(r.municipio_id) ?? 0) + 1);
      porModalidade.set(r.modalidade_nome, (porModalidade.get(r.modalidade_nome) ?? 0) + 1);
      porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + 1);
      porNaipe.set(r.naipe, (porNaipe.get(r.naipe) ?? 0) + 1);
      porEscola.set(r.escola_id, (porEscola.get(r.escola_id) ?? 0) + 1);
    }

    const topMunicipios = Array.from(porMunicipio.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qtd]) => ({ nome: nomeMun(id), qtd }));

    const topModalidades = Array.from(porModalidade.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([nome, qtd]) => ({ nome, qtd }));

    const topEscolas = Array.from(porEscola.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qtd]) => ({ nome: nomeEscola(id), qtd }));

    return {
      total,
      topMunicipios,
      topModalidades,
      topEscolas,
      cat: Array.from(porCategoria.entries()).map(([k, v]) => ({ k, v })),
      naipe: Array.from(porNaipe.entries()).map(([k, v]) => ({ k, v })),
    };
  }, [linhas, municipios, escolas]);

  const precisaEvento = useMemo(() => !Number(fEventoId), [fEventoId]);

  async function exportarCSV() {
  setMsg("Gerando CSV...");

  const rows = await buscarDetalhado();
  if (rows.length === 0) return setMsg("Nenhum registro para o recorte selecionado.");

  const header = [
    "atleta_nome",
    "evento",
    "modalidade",
    "tipo",
    "prova",
    "categoria",
    "naipe",
    "status",
    "municipio_id",
    "escola_id",
  ];

  const body = rows.map((r) => [
    r.atleta_nome ?? "",
    r.evento_nome ?? "",
    r.modalidade_nome ?? "",
    r.modalidade_tipo ?? "",
    r.prova_nome ?? "",
    r.categoria ?? "",
    r.naipe ?? "",
    r.status_inscr ?? "",
    r.municipio_id ?? "",
    r.escola_id ?? "",
  ]);

  const nome = `relatorio_inscricoes_${new Date()
  .toISOString()
  .slice(0, 10)}.csv`;

const csv = [header, ...body]
  .map((row) => row.map(csvEscape).join(";")) // 👈 usa ;
  .join("\n");

downloadTextFile(
  nome,
  "\uFEFF" + csv, // 👈 BOM para Excel
  "text/csv;charset=utf-8;"
);

  setMsg("CSV gerado ✅");
}

  async function gerarPDF() {
    setMsg("Gerando PDF...");

    const params = new URLSearchParams();
    if (fEventoId) params.set("evento_id", fEventoId);
    if (fMunicipioId) params.set("municipio_id", fMunicipioId);
    if (fEscolaId) params.set("escola_id", fEscolaId);
    if (fModalidadeId) params.set("modalidade_id", fModalidadeId);

    // ✅ prova_id só quando escolher uma prova específica
    if (fProvaId) params.set("prova_id", fProvaId);

    if (fTipo) params.set("tipo", fTipo);
    if (fCategoria) params.set("categoria", fCategoria);
    if (fNaipe) params.set("naipe", fNaipe);
    if (fStatus) params.set("status", fStatus);

    const url = `/api/relatorios/inscricoes?${params.toString()}`;
    window.open(url, "_blank");
    setMsg("PDF gerado ✅");
  }

  useEffect(() => {
    (async () => {
      await carregarFiltrosBase();
      await buscar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // quando muda município: reseta escola
  useEffect(() => {
    setFEscolaId("");
  }, [fMunicipioId]);

  // quando muda evento: carrega modalidades e provas (todas do evento)
  useEffect(() => {
    (async () => {
      const eid = Number(fEventoId);
      await carregarModalidadesDoEvento(eid);
      await carregarProvas(eid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fEventoId]);

  // quando muda modalidade: atualiza provas (do evento + modalidade)
  useEffect(() => {
    const eid = Number(fEventoId);
    const mid = Number(fModalidadeId);
    if (!eid) return;
    carregarProvas(eid, mid || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fModalidadeId]);

  const card: React.CSSProperties = { border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" };
  const tiny: React.CSSProperties = { fontSize: 12, opacity: 0.8 };
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" };

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Relatórios</h1>

      {/* FILTROS BASE */}
      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 1fr", alignItems: "end" }}>
        <div>
          <div style={tiny}>Evento</div>
          <select value={fEventoId} onChange={(e) => setFEventoId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={tiny}>Município</div>
          <select value={fMunicipioId} onChange={(e) => setFMunicipioId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={tiny}>Escola</div>
          <select value={fEscolaId} onChange={(e) => setFEscolaId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            {escolasFiltradas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={buscar} style={{ padding: 10, borderRadius: 8, cursor: "pointer", flex: 1 }}>
            Atualizar
          </button>
          <button onClick={exportarCSV} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
            Excel (CSV)
          </button>
          <button onClick={gerarPDF} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
            PDF
          </button>
        </div>
      </div>

      {/* FILTROS EXTRA (6 colunas agora, por causa de Prova) */}
      <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr" }}>
        <div>
          <div style={tiny}>Tipo</div>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="INDIVIDUAL">INDIVIDUAL</option>
            <option value="COLETIVA">COLETIVA</option>
          </select>
        </div>

        <div>
          <div style={tiny}>Modalidade</div>
          <select
            value={fModalidadeId}
            onChange={(e) => setFModalidadeId(e.target.value)}
            style={{ padding: 10, width: "100%" }}
            disabled={!Number(fEventoId)}
          >
            <option value="">{Number(fEventoId) ? "Todas" : "Selecione um evento"}</option>
            {modalidades.map((m) => (
              <option key={`${m.evento_modalidade_id}`} value={m.modalidade_id}>
                {m.modalidade_nome} • {m.tipo} • {m.categoria} • {m.naipe}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ Prova */}
        <div>
          <div style={tiny}>Prova</div>
          <select
            value={fProvaId}
            onChange={(e) => setFProvaId(e.target.value)}
            style={{ padding: 10, width: "100%" }}
            disabled={!Number(fEventoId)}
          >
            <option value="">{Number(fEventoId) ? "Todas" : "Selecione um evento"}</option>
            {provas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={tiny}>Categoria</div>
          <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            <option value="12-14">12-14</option>
            <option value="15-17">15-17</option>
          </select>
        </div>

        <div>
          <div style={tiny}>Naipe</div>
          <select value={fNaipe} onChange={(e) => setFNaipe(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>

        <div>
          <div style={tiny}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="ATIVA">ATIVA</option>
            <option value="PENDENTE">PENDENTE</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="CANCELADA">CANCELADA</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{msg}</div>

      {/* KPIs */}
      <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div style={card}>
          <div style={tiny}>Atletas únicos (no evento)</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{precisaEvento ? "—" : "OK"}</div>
          {precisaEvento && <div style={{ fontSize: 12, opacity: 0.7 }}>Selecione um evento</div>}
        </div>
        <div style={card}>
          <div style={tiny}>Técnicos ativos (no evento)</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{precisaEvento ? "—" : "OK"}</div>
          {precisaEvento && <div style={{ fontSize: 12, opacity: 0.7 }}>Selecione um evento</div>}
        </div>
        <div style={card}>
          <div style={tiny}>Equipes concluídas (no evento)</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{precisaEvento ? "—" : "OK"}</div>
          {precisaEvento && <div style={{ fontSize: 12, opacity: 0.7 }}>Selecione um evento</div>}
        </div>
        <div style={card}>
          <div style={tiny}>Equipes pendentes (no evento)</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{precisaEvento ? "—" : "OK"}</div>
          {precisaEvento && <div style={{ fontSize: 12, opacity: 0.7 }}>Selecione um evento</div>}
        </div>
      </div>

      {/* Cards principais */}
      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Total de inscrições no recorte</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{totais.total}</div>

          <div style={{ marginTop: 12, ...tiny }}>Por categoria</div>
          {totais.cat.map((x) => (
            <div key={x.k} style={row}>
              <span>{x.k}</span>
              <span>{x.v}</span>
            </div>
          ))}

          <div style={{ marginTop: 12, ...tiny }}>Por naipe</div>
          {totais.naipe.map((x) => (
            <div key={x.k} style={row}>
              <span>{x.k === "M" ? "Masculino" : "Feminino"}</span>
              <span>{x.v}</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700 }}>Top municípios (mais inscrições)</div>
          <div style={{ marginTop: 8 }}>
            {totais.topMunicipios.map((x) => (
              <div key={x.nome} style={row}>
                <span>{x.nome}</span>
                <span>{x.qtd}</span>
              </div>
            ))}
            {totais.topMunicipios.length === 0 && <div style={{ paddingTop: 8 }}>—</div>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card }}>
        <div style={{ fontWeight: 700 }}>Top escolas (mais inscrições)</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
          {totais.topEscolas.map((x) => (
            <div key={x.nome} style={{ display: "contents" }}>
              <div style={{ fontSize: 13 }}>{x.nome}</div>
              <div style={{ fontSize: 13, textAlign: "right" }}>{x.qtd}</div>
            </div>
          ))}
          {totais.topEscolas.length === 0 && <div>—</div>}
        </div>
      </div>

      <div style={{ marginTop: 12, ...card }}>
        <div style={{ fontWeight: 700 }}>Top modalidades</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
          {totais.topModalidades.map((x) => (
            <div key={x.nome} style={{ display: "contents" }}>
              <div style={{ fontSize: 13 }}>{x.nome}</div>
              <div style={{ fontSize: 13, textAlign: "right" }}>{x.qtd}</div>
            </div>
          ))}
          {totais.topModalidades.length === 0 && <div>—</div>}
        </div>
      </div>
    </main>
  );
}