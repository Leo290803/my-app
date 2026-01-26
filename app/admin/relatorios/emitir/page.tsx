"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

type Evento = { id: number; nome: string };
type Modalidade = { id: number; nome: string };
type Prova = { id: number; nome: string; modalidade_id: number };

type Municipio = { id: number; nome: string };
type Escola = { id: number; nome: string; municipio_id: number };

type Row = {
  evento_id: number;
  evento_nome: string;

  modalidade_id: number;
  modalidade_nome: string;

  prova_id: number;
  prova_nome: string;

  categoria: string; // "12-14" | "15-17" etc
  naipe: string;     // "M" | "F"

  atleta_id: number;
  atleta_nome: string;

  municipio_id: number;
  escola_id: number;

  status: string; // "ATIVA" | "CANCELADA" (conforme sua tabela)
};

export default function AdminEmitirRelatorioPage() {
  const [msg, setMsg] = useState("");

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [fEvento, setFEvento] = useState<string>("");
  const [fModalidade, setFModalidade] = useState<string>("");
  const [fProva, setFProva] = useState<string>("");

  const [fCategoria, setFCategoria] = useState<string>("");
  const [fNaipe, setFNaipe] = useState<string>("");

  const [fStatus, setFStatus] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const provasFiltradas = useMemo(() => {
    const mid = Number(fModalidade);
    if (!mid) return provas;
    return provas.filter((p) => p.modalidade_id === mid);
  }, [provas, fModalidade]);

  function nomeMunicipio(id: number) {
    return municipios.find((m) => m.id === id)?.nome ?? `Município #${id}`;
  }

  function nomeEscola(id: number) {
    return escolas.find((e) => e.id === id)?.nome ?? `Escola #${id}`;
  }

  async function carregar() {
    setMsg("");
    setLoading(true);

    // Eventos
    const ev = await supabase
      .from("eventos")
      .select("id, nome")
      .order("created_at", { ascending: false });

    // Modalidades
    const mod = await supabase
      .from("modalidades")
      .select("id, nome")
      .order("nome");

    // Provas
    const pr = await supabase
      .from("provas")
      .select("id, nome, modalidade_id")
      .order("nome");

    // Municipios
    const mu = await supabase
      .from("municipios")
      .select("id, nome")
      .order("nome");

    // Escolas
    const es = await supabase
      .from("escolas")
      .select("id, nome, municipio_id")
      .order("nome");

    // Erros
    const errs = [ev.error, mod.error, pr.error, mu.error, es.error].filter(Boolean);
    if (errs.length) {
      setMsg("Erro ao carregar filtros: " + errs.map((e: any) => e.message).join(" | "));
      setLoading(false);
      return;
    }

    setEventos((ev.data ?? []) as any);
    setModalidades((mod.data ?? []) as any);
    setProvas((pr.data ?? []) as any);
    setMunicipios((mu.data ?? []) as any);
    setEscolas((es.data ?? []) as any);

    setLoading(false);
  }

  async function emitir() {
    setMsg("");
    setLoading(true);
    setRows([]);

    let q = supabase
      .from("v_relatorio_provas")
      .select("*")
      .order("atleta_nome", { ascending: true })
      .limit(10000);

    if (fEvento) q = q.eq("evento_id", Number(fEvento));
    if (fModalidade) q = q.eq("modalidade_id", Number(fModalidade));
    if (fProva) q = q.eq("prova_id", Number(fProva));
    if (fCategoria) q = q.eq("categoria", fCategoria);
    if (fNaipe) q = q.eq("naipe", fNaipe);
    if (fStatus) q = q.eq("status", fStatus);

    const { data, error } = await q;

    if (error) {
      setMsg("Erro ao emitir: " + error.message);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as any);
    setMsg(`OK: ${(data ?? []).length} registro(s)`);

    setLoading(false);
  }

  // Resumos
  const resumo = useMemo(() => {
    const total = rows.length;

    const porMunicipio = new Map<number, number>();
    const porEscola = new Map<number, number>();

    for (const r of rows) {
      porMunicipio.set(r.municipio_id, (porMunicipio.get(r.municipio_id) ?? 0) + 1);
      porEscola.set(r.escola_id, (porEscola.get(r.escola_id) ?? 0) + 1);
    }

    const topMunicipios = Array.from(porMunicipio.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qtd]) => ({ id, nome: nomeMunicipio(id), qtd }));

    const topEscolas = Array.from(porEscola.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([id, qtd]) => ({ id, nome: nomeEscola(id), qtd }));

    return { total, topMunicipios, topEscolas };
  }, [rows, municipios, escolas]);

  useEffect(() => {
    carregar();
  }, []);

  // Quando mudar modalidade, limpa prova
  useEffect(() => {
    setFProva("");
  }, [fModalidade]);

  return (
    <main style={{ padding: 24, maxWidth: 1250 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Admin • Emitir Relatório (Provas)</h1>

      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
        Dica: se você escolher uma <b>Prova</b> (ex: 80m) e não filtrar município/escola, o relatório traz <b>todos os municípios</b>.
      </div>

      {/* Filtros */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 1fr",
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Evento</div>
          <select value={fEvento} onChange={(e) => setFEvento(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            {eventos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Modalidade</div>
          <select value={fModalidade} onChange={(e) => setFModalidade(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            {modalidades.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Prova</div>
          <select value={fProva} onChange={(e) => setFProva(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            {provasFiltradas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Categoria</div>
          <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            <option value="12-14">12–14</option>
            <option value="15-17">15–17</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Naipe</div>
          <select value={fNaipe} onChange={(e) => setFNaipe(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="ATIVA">Ativa</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Ações */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={emitir} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }} disabled={loading}>
          {loading ? "Aguarde..." : "Emitir"}
        </button>

        <button
          onClick={() => {
            setFEvento("");
            setFModalidade("");
            setFProva("");
            setFCategoria("");
            setFNaipe("");
            setFStatus("");
            setRows([]);
            setMsg("");
          }}
          style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
          disabled={loading}
        >
          Limpar filtros
        </button>

        <div style={{ fontSize: 13, opacity: 0.85, marginLeft: "auto" }}>
          {msg || "—"}
        </div>
      </div>

      {/* Resumo */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Total</div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6 }}>{resumo.total}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            (Se passar de 10.000, a gente faz paginação)
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Top municípios (no recorte)</div>
          <div style={{ marginTop: 8 }}>
            {resumo.topMunicipios.length === 0 ? (
              <div style={{ opacity: 0.8 }}>—</div>
            ) : (
              resumo.topMunicipios.map((x) => (
                <div key={x.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span>{x.nome}</span>
                  <span style={{ fontWeight: 800 }}>{x.qtd}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 800 }}>Top escolas (no recorte)</div>
        <div style={{ marginTop: 8 }}>
          {resumo.topEscolas.length === 0 ? (
            <div style={{ opacity: 0.8 }}>—</div>
          ) : (
            resumo.topEscolas.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span>{x.nome}</span>
                <span style={{ fontWeight: 800 }}>{x.qtd}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ padding: 10, fontWeight: 800 }}>Resultado</div>

        <div
          style={{
            padding: 10,
            display: "grid",
            gridTemplateColumns: "80px 1.3fr 1fr 1fr 120px 90px 110px",
            gap: 10,
            fontWeight: 800,
            borderTop: "1px solid #eee",
            fontSize: 13,
          }}
        >
          <span>ID</span>
          <span>Atleta</span>
          <span>Modalidade</span>
          <span>Prova</span>
          <span>Categoria</span>
          <span>Naipe</span>
          <span>Status</span>
        </div>

        {rows.map((r) => (
          <div
            key={`${r.atleta_id}-${r.prova_id}-${r.evento_id}`}
            style={{
              padding: 10,
              display: "grid",
              gridTemplateColumns: "80px 1.3fr 1fr 1fr 120px 90px 110px",
              gap: 10,
              borderTop: "1px solid #eee",
              fontSize: 13,
              alignItems: "center",
            }}
          >
            <span>#{r.atleta_id}</span>
            <span style={{ fontWeight: 700 }}>{r.atleta_nome}</span>
            <span>{r.modalidade_nome}</span>
            <span>{r.prova_nome}</span>
            <span>{r.categoria}</span>
            <span>{r.naipe === "M" ? "Masc" : r.naipe === "F" ? "Fem" : r.naipe}</span>
            <span>{r.status}</span>
          </div>
        ))}

        {rows.length === 0 && <div style={{ padding: 12, opacity: 0.85 }}>Nenhum registro.</div>}
      </div>
    </main>
  );
}
