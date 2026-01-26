"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Municipio = { id: number; nome: string };
type Escola = { id: number; nome: string; municipio_id: number };

type Atleta = {
  id: number;
  nome: string;
  sexo: "M" | "F";
  escola_id: number;
  municipio_id: number;
};

export default function AdminCrachasPage() {
  const [msg, setMsg] = useState("");

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [fMunicipioId, setFMunicipioId] = useState<string>("");
  const [fEscolaId, setFEscolaId] = useState<string>("");

  const [busca, setBusca] = useState("");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  const escolasFiltradas = useMemo(() => {
    const mid = Number(fMunicipioId);
    if (!mid) return escolas;
    return escolas.filter((e) => e.municipio_id === mid);
  }, [escolas, fMunicipioId]);

  const atletasFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return atletas;
    return atletas.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, busca]);

  function escolaNome(id: number) {
    return escolas.find((e) => e.id === id)?.nome ?? "—";
  }
  function municipioNome(id: number) {
    return municipios.find((m) => m.id === id)?.nome ?? "—";
  }

  async function carregarFiltros() {
    const m = await supabase.from("municipios").select("id, nome").order("nome");
    if (m.error) setMsg("Erro municípios: " + m.error.message);
    setMunicipios((m.data ?? []) as any);

    const e = await supabase.from("escolas").select("id, nome, municipio_id").order("nome");
    if (e.error) setMsg("Erro escolas: " + e.error.message);
    setEscolas((e.data ?? []) as any);
  }

  async function buscar() {
    setMsg("Carregando...");
    setSelecionados(new Set());

    let q = supabase
      .from("atletas")
      .select("id, nome, sexo, escola_id, municipio_id")
      .eq("ativo", true)
      .order("nome")
      .limit(500);

    const mid = Number(fMunicipioId);
    const eid = Number(fEscolaId);

    if (mid) q = q.eq("municipio_id", mid);
    if (eid) q = q.eq("escola_id", eid);

    const { data, error } = await q;
    if (error) return setMsg("Erro atletas: " + error.message);

    setAtletas((data ?? []) as any);
    setMsg(`OK: ${(data ?? []).length} atleta(s)`);
  }

  function toggle(id: number) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function marcarTodosVisiveis() {
    setSelecionados((prev) => {
      const n = new Set(prev);
      atletasFiltrados.forEach((a) => n.add(a.id));
      return n;
    });
  }

  function desmarcarTodos() {
    setSelecionados(new Set());
  }

  function abrirCracha(atletaId: number) {
    window.open(`/api/cracha?atletaId=${atletaId}`, "_blank");
  }

  async function gerarLote() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) {
      setMsg("Selecione pelo menos 1 atleta para gerar o lote.");
      return;
    }

    setMsg("Gerando PDF em lote...");

    const res = await fetch("/api/cracha/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atletaIds: ids }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erro: " + (j.error || "Falha ao gerar lote"));
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");

    setMsg(`Lote gerado ✅ (${ids.length} crachá(s))`);
  }

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
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Crachás</h1>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 140px", alignItems: "end" }}>
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

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Buscar por nome</div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite parte do nome..."
            style={{ padding: 10, width: "100%" }}
          />
        </div>

        <button onClick={buscar} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Buscar
        </button>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={marcarTodosVisiveis} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Marcar visíveis
        </button>
        <button onClick={desmarcarTodos} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Limpar seleção
        </button>
        <button onClick={gerarLote} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Gerar lote (PDF)
        </button>

        <div style={{ marginLeft: "auto", fontSize: 13, opacity: 0.85 }}>
          Selecionados: {selecionados.size} • {msg}
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ padding: 10, fontWeight: 700, display: "grid", gridTemplateColumns: "40px 80px 1fr 1fr 1fr 140px", gap: 10 }}>
          <span></span>
          <span>ID</span>
          <span>Nome</span>
          <span>Escola</span>
          <span>Município</span>
          <span>Ação</span>
        </div>

        {atletasFiltrados.map((a) => (
          <div
            key={a.id}
            style={{
              padding: 10,
              borderTop: "1px solid #eee",
              display: "grid",
              gridTemplateColumns: "40px 80px 1fr 1fr 1fr 140px",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input type="checkbox" checked={selecionados.has(a.id)} onChange={() => toggle(a.id)} />
            <span>#{a.id}</span>
            <span style={{ fontWeight: 600 }}>{a.nome}</span>
            <span>{escolaNome(a.escola_id)}</span>
            <span>{municipioNome(a.municipio_id)}</span>
            <button onClick={() => abrirCracha(a.id)} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
              1 PDF
            </button>
          </div>
        ))}

        {atletasFiltrados.length === 0 && <div style={{ padding: 12 }}>Nenhum atleta.</div>}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        * No MVP, carrega até 500 atletas por vez (performance). Depois fazemos paginação.
      </div>
    </main>
  );
}
