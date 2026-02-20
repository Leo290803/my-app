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

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export default function AdminCrachasPage() {
  const [msg, setMsg] = useState("");

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [fMunicipioId, setFMunicipioId] = useState<string>("");
  const [fEscolaId, setFEscolaId] = useState<string>("");

  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebouncedValue(busca, 300);

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  // paginação
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1); // 1-based
  const [total, setTotal] = useState<number>(0);

  const escolasFiltradas = useMemo(() => {
    const mid = Number(fMunicipioId);
    if (!mid) return escolas;
    return escolas.filter((e) => e.municipio_id === mid);
  }, [escolas, fMunicipioId]);

  const atletasFiltrados = useMemo(() => {
    const b = buscaDebounced.trim().toLowerCase();
    if (!b) return atletas;
    return atletas.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, buscaDebounced]);

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

  function buildQueryBase() {
    let q = supabase
      .from("atletas")
      .select("id, nome, sexo, escola_id, municipio_id", { count: "exact" })
      .eq("ativo", true)
      .order("nome");

    const mid = Number(fMunicipioId);
    const eid = Number(fEscolaId);

    if (mid) q = q.eq("municipio_id", mid);
    if (eid) q = q.eq("escola_id", eid);

    // Se você quiser fazer a busca no banco (mais correto), ative isso:
    // if (buscaDebounced.trim()) q = q.ilike("nome", `%${buscaDebounced.trim()}%`);

    return q;
  }

  async function buscar() {
    setMsg("Carregando...");
    setSelecionados(new Set());

    // range para paginação
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await buildQueryBase().range(from, to);

    if (error) return setMsg("Erro atletas: " + error.message);

    setAtletas((data ?? []) as any);
    setTotal(count ?? 0);

    setMsg(`OK: ${count ?? 0} atleta(s) no recorte`);
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

  async function selecionarTodosDoRecorte() {
    setMsg("Selecionando todos do recorte...");
    const { data, error } = await buildQueryBase().select("id");

    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }

    const ids = (data ?? []).map((x: any) => Number(x.id)).filter(Boolean);
    setSelecionados(new Set(ids));
    setMsg(`Selecionados: ${ids.length} atleta(s)`);
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

  async function exportarCSVSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) {
      setMsg("Selecione pelo menos 1 atleta para exportar.");
      return;
    }

    setMsg("Gerando CSV (Excel)...");

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo, escola_id, municipio_id")
      .in("id", ids)
      .order("nome");

    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }

    const flat = (data ?? []).map((a: any) => ({
      id: a.id,
      nome: a.nome,
      sexo: a.sexo,
      escola: escolaNome(a.escola_id),
      municipio: municipioNome(a.municipio_id),
    }));

    downloadCSV(`crachas_selecionados_${new Date().toISOString().slice(0, 10)}.csv`, flat);
    setMsg("CSV baixado ✅");
  }

  async function exportarCSVRecorte() {
    setMsg("Gerando CSV do recorte inteiro...");

    const { data, error } = await buildQueryBase();
    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }

    const flat = (data ?? []).map((a: any) => ({
      id: a.id,
      nome: a.nome,
      sexo: a.sexo,
      escola: escolaNome(a.escola_id),
      municipio: municipioNome(a.municipio_id),
    }));

    downloadCSV(`crachas_recorte_${new Date().toISOString().slice(0, 10)}.csv`, flat);
    setMsg("CSV baixado ✅");
  }

  // quando muda filtro/busca/páginação, volta página 1
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fMunicipioId, fEscolaId, pageSize, buscaDebounced]);

  useEffect(() => {
    carregarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fMunicipioId, fEscolaId, pageSize, buscaDebounced]);

  useEffect(() => {
    setFEscolaId("");
  }, [fMunicipioId]);

  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Crachás</h1>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 160px 140px", alignItems: "end" }}>
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

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Por página</div>
          <select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: 10, width: "100%" }}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>

        <button onClick={() => { setPage(1); buscar(); }} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Buscar
        </button>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={marcarTodosVisiveis} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Marcar visíveis
        </button>

        <button onClick={selecionarTodosDoRecorte} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Selecionar todos do recorte
        </button>

        <button onClick={desmarcarTodos} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Limpar seleção
        </button>

        <button onClick={gerarLote} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Gerar lote (PDF)
        </button>

        <button onClick={exportarCSVSelecionados} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Exportar selecionados (Excel/CSV)
        </button>

        <button onClick={exportarCSVRecorte} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Exportar recorte (Excel/CSV)
        </button>

        <div style={{ marginLeft: "auto", fontSize: 13, opacity: 0.85 }}>
          Selecionados: <b>{selecionados.size}</b> • Total: <b>{total}</b> • Página: <b>{page}</b> • {msg}
        </div>
      </div>

      {/* paginação */}
      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: "8px 12px", borderRadius: 8 }}>
          ← Anterior
        </button>
        <button disabled={!canNext} onClick={() => setPage((p) => p + 1)} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Próxima →
        </button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Mostrando {atletas.length} nesta página
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
        ✅ Agora tem paginação e exportação. Se você quiser, o próximo passo é deixar a busca (nome) 100% no banco com <code>ilike</code> (melhor em base grande).
      </div>
    </main>
  );
}
