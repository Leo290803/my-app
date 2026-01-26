"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Evento = { id: number; nome: string; municipio_id: number | null };
type Municipio = { id: number; nome: string };
type Escola = { id: number; nome: string; municipio_id: number };

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

export default function AdminRelatoriosPage() {
  const [msg, setMsg] = useState("");

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [fEventoId, setFEventoId] = useState<string>("");
  const [fMunicipioId, setFMunicipioId] = useState<string>("");
  const [fEscolaId, setFEscolaId] = useState<string>("");

  const [linhas, setLinhas] = useState<RowResumo[]>([]);

  const escolasFiltradas = useMemo(() => {
    const mid = Number(fMunicipioId);
    if (!mid) return escolas;
    return escolas.filter((e) => e.municipio_id === mid);
  }, [escolas, fMunicipioId]);

  function nomeMun(id: number) {
    return municipios.find((m) => m.id === id)?.nome ?? "—";
  }

  async function carregarFiltros() {
    const ev = await supabase.from("eventos").select("id, nome, municipio_id").order("created_at", { ascending: false });
    setEventos((ev.data ?? []) as any);

    const m = await supabase.from("municipios").select("id, nome").order("nome");
    setMunicipios((m.data ?? []) as any);

    const e = await supabase.from("escolas").select("id, nome, municipio_id").order("nome");
    setEscolas((e.data ?? []) as any);
  }

  async function buscar() {
    setMsg("Carregando dashboard...");

    let q = supabase
      .from("v_inscricoes_resumo")
      .select("*");

    const eid = Number(fEventoId);
    const mid = Number(fMunicipioId);
    const sid = Number(fEscolaId);

    if (eid) q = q.eq("evento_id", eid);
    if (mid) q = q.eq("municipio_id", mid);
    if (sid) q = q.eq("escola_id", sid);

    const { data, error } = await q;
    if (error) return setMsg("Erro: " + error.message);

    setLinhas((data ?? []) as any);
    setMsg(`OK: ${(data ?? []).length} inscrição(ões) no recorte`);
  }

  const totais = useMemo(() => {
    const total = linhas.length;

    const porMunicipio = new Map<number, number>();
    const porModalidade = new Map<string, number>();
    const porCategoria = new Map<string, number>();
    const porNaipe = new Map<string, number>();

    for (const r of linhas) {
      porMunicipio.set(r.municipio_id, (porMunicipio.get(r.municipio_id) ?? 0) + 1);
      porModalidade.set(r.modalidade_nome, (porModalidade.get(r.modalidade_nome) ?? 0) + 1);
      porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + 1);
      porNaipe.set(r.naipe, (porNaipe.get(r.naipe) ?? 0) + 1);
    }

    const topMunicipios = Array.from(porMunicipio.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qtd]) => ({ nome: nomeMun(id), qtd }));

    const topModalidades = Array.from(porModalidade.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([nome, qtd]) => ({ nome, qtd }));

    return {
      total,
      topMunicipios,
      topModalidades,
      cat: Array.from(porCategoria.entries()).map(([k, v]) => ({ k, v })),
      naipe: Array.from(porNaipe.entries()).map(([k, v]) => ({ k, v })),
    };
  }, [linhas, municipios]);

  useEffect(() => {
    carregarFiltros();
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFEscolaId("");
  }, [fMunicipioId]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Relatórios</h1>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 140px", alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Evento</div>
          <select value={fEventoId} onChange={(e) => setFEventoId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Município</div>
          <select value={fMunicipioId} onChange={(e) => setFMunicipioId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Escola</div>
          <select value={fEscolaId} onChange={(e) => setFEscolaId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            {escolasFiltradas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>

        <button onClick={buscar} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Atualizar
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{msg}</div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>Total de inscrições no recorte</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{totais.total}</div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Por categoria</div>
          {totais.cat.map((x) => (
            <div key={x.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{x.k}</span>
              <span>{x.v}</span>
            </div>
          ))}

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Por naipe</div>
          {totais.naipe.map((x) => (
            <div key={x.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{x.k === "M" ? "Masculino" : "Feminino"}</span>
              <span>{x.v}</span>
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>Top municípios (mais inscrições)</div>
          <div style={{ marginTop: 8 }}>
            {totais.topMunicipios.map((x) => (
              <div key={x.nome} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span>{x.nome}</span>
                <span>{x.qtd}</span>
              </div>
            ))}
            {totais.topMunicipios.length === 0 && <div style={{ paddingTop: 8 }}>—</div>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
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
