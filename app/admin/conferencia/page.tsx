"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Escola = { id: number; nome: string; municipio_id: number | null; municipios?: { nome: string } | null };
type Municipio = { id: number; nome: string };

type Row = {
  id: number;
  participante_tipo: string | null; // ATLETA / TECNICO / OFICIAL / CHEFE / etc
  participante_id: number | null;
  escola_id: number | null;
  status: "PENDENTE" | "CONCLUIDO" | "REJEITADO";
  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;
  observacao: string | null; // do gestor (se usar)
  observacao_admin: string | null;
  created_at: string;
  updated_at: string;
  participante_nome: string | null;
escola_nome?: string | null;
  municipio_nome?: string | null;
};

export default function AdminConferenciaPage() {
  const [msg, setMsg] = useState("");

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [fMunicipio, setFMunicipio] = useState<string>("");
  const [fEscola, setFEscola] = useState<string>("");
  const [fTipo, setFTipo] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [buscaId, setBuscaId] = useState<string>(""); // busca por participante_id (rápido e confiável)

  // seleção em lote
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  const escolasFiltradas = useMemo(() => {
    const mid = Number(fMunicipio);
    if (!mid) return escolas;
    return escolas.filter((e) => e.municipio_id === mid);
  }, [fMunicipio, escolas]);

  const contagem = useMemo(() => {
    const total = rows.length;
    const pend = rows.filter((r) => r.status === "PENDENTE").length;
    const conc = rows.filter((r) => r.status === "CONCLUIDO").length;
    const rej = rows.filter((r) => r.status === "REJEITADO").length;
    return { total, pend, conc, rej };
  }, [rows]);

  function toggleSel(id: number) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAllCurrent() {
    setSelecionados(new Set(rows.map((r) => r.id)));
  }

  function clearSelection() {
    setSelecionados(new Set());
  }

  async function carregarFiltros() {
    setMsg("");

    const m = await supabase.from("municipios").select("id, nome").order("nome");
    if (m.error) setMsg("Erro municípios: " + m.error.message);
    setMunicipios((m.data ?? []) as any);

    const e = await supabase
      .from("escolas")
      .select("id, nome, municipio_id, municipios(nome)")
      .order("nome");

    if (e.error) setMsg("Erro escolas: " + e.error.message);
    setEscolas((e.data ?? []) as any);
  }

  async function carregar() {
    setMsg("");
    setLoading(true);
    setSelecionados(new Set());

let q = supabase
  .from("conferencia_itens")
  .select(
    "id, participante_tipo, participante_id, participante_nome, escola_id, escola_nome, municipio_nome, status, foto_url, ficha_url, doc_url, observacao, observacao_admin, created_at, updated_at"
  )
  .order("updated_at", { ascending: false })
  .limit(500);


    const mid = Number(fMunicipio);
    const eid = Number(fEscola);

    if (eid) q = q.eq("escola_id", eid);
    // se escolheu município e não escolheu escola: filtra por escolas daquele município (client-side)
    if (fStatus) q = q.eq("status", fStatus);
    if (fTipo) q = q.eq("participante_tipo", fTipo);

    const bid = Number(buscaId);
    if (bid) q = q.eq("participante_id", bid);

    const { data, error } = await q;

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    let list = (data ?? []) as Row[];

    if (mid && !eid) {
      const escolasDoMunicipio = new Set(escolas.filter((x) => x.municipio_id === mid).map((x) => x.id));
      list = list.filter((r) => (r.escola_id ? escolasDoMunicipio.has(r.escola_id) : false));
    }

    setRows(list);
    setLoading(false);
  }

  async function setStatus(ids: number[], status: Row["status"], obsAdmin?: string) {
    setMsg("");
    if (ids.length === 0) return setMsg("Selecione pelo menos 1 item.");

    const payload: any = { status, observacao_admin: obsAdmin ?? null };

    const { error } = await supabase.from("participante_arquivos").update(payload).in("id", ids);
    if (error) return setMsg("Erro ao atualizar: " + error.message);

    setMsg(`Atualizado ✅ (${ids.length}) → ${status}`);
    carregar();
  }

  async function concluirSelecionados() {
    await setStatus(Array.from(selecionados), "CONCLUIDO");
  }

  async function devolverPendenciaSelecionados() {
    const obs = prompt("Observação para o gestor (opcional):") || "";
    await setStatus(Array.from(selecionados), "PENDENTE", obs);
  }

  async function rejeitarSelecionados() {
    const obs = prompt("Motivo da rejeição (obrigatório):") || "";
    if (!obs.trim()) return setMsg("Informe o motivo da rejeição.");
    await setStatus(Array.from(selecionados), "REJEITADO", obs.trim());
  }

  function escolaLabel(id: number | null) {
    if (!id) return "—";
    const e = escolas.find((x) => x.id === id);
    if (!e) return `#${id}`;
    const mun = e.municipios?.nome ? ` • ${e.municipios.nome}` : "";
    return `${e.nome}${mun}`;
  }

  function chipOk(url: string | null) {
    return url ? "✅" : "—";
  }

  useEffect(() => {
    carregarFiltros();
  }, []);

  // recarrega ao mudar filtros principais (com um pequeno “debounce” simples)
  useEffect(() => {
    const t = setTimeout(() => carregar(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fMunicipio, fEscola, fTipo, fStatus, buscaId, escolas.length]);

  return (
    <main style={{ padding: 24, maxWidth: 1300 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Admin • Conferência (Pendências)</h1>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          Total: <b>{contagem.total}</b>
        </div>
        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          Pendentes: <b>{contagem.pend}</b>
        </div>
        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          Concluídos: <b>{contagem.conc}</b>
        </div>
        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          Rejeitados: <b>{contagem.rej}</b>
        </div>
      </div>

      {/* filtros */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Município</div>
          <select value={fMunicipio} onChange={(e) => setFMunicipio(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Escola</div>
          <select value={fEscola} onChange={(e) => setFEscola(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            {escolasFiltradas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Tipo</div>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="ATLETA">ATLETA</option>
            <option value="TECNICO">TÉCNICO</option>
            <option value="OFICIAL">OFICIAL</option>
            <option value="CHEFE">CHEFE</option>
            <option value="GESTOR">GESTOR</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="PENDENTE">PENDENTE</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="REJEITADO">REJEITADO</option>
            <option value="">Todos</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Buscar por participante_id</div>
          <input
            value={buscaId}
            onChange={(e) => setBuscaId(e.target.value)}
            placeholder="ex: 1234"
            style={{ padding: 10, width: "100%" }}
          />
        </div>
      </div>

      {/* ações em lote */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={selectAllCurrent} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Selecionar todos da tela
        </button>
        <button onClick={clearSelection} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Limpar seleção
        </button>

        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          Selecionados: <b>{selecionados.size}</b>
        </div>

        <button onClick={concluirSelecionados} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Marcar CONCLUÍDO ✅
        </button>
        <button onClick={devolverPendenciaSelecionados} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Voltar para PENDENTE ↩️
        </button>
        <button onClick={rejeitarSelecionados} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Marcar REJEITADO ❌
        </button>

        <button onClick={carregar} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Recarregar
        </button>

        {loading && <span style={{ opacity: 0.8 }}>Carregando...</span>}
      </div>

      {/* tabela */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 90px 1fr 90px 90px 90px 120px 220px",
            gap: 0,
            padding: 10,
            background: "#fafafa",
            fontWeight: 800,
            borderBottom: "1px solid #eee",
          }}
        >
          <div>#</div>
          <div>Tipo</div>
          <div>Escola</div>
          <div>Foto</div>
          <div>Ficha</div>
          <div>Doc</div>
          <div>Status</div>
          <div>Ações</div>
        </div>

        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 90px 1fr 90px 90px 90px 120px 220px",
              padding: 10,
              borderBottom: "1px solid #eee",
              alignItems: "center",
              gap: 0,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={selecionados.has(r.id)} onChange={() => toggleSel(r.id)} />
              <b>{r.id}</b>
            </div>

            <div>{r.participante_tipo ?? "—"}</div>

<div style={{ fontWeight: 800 }}>
  {r.participante_nome ?? `ID ${r.participante_id ?? "—"}`}
</div>
<div style={{ fontSize: 12, opacity: 0.75 }}>
  {r.escola_nome ?? "—"} • {r.municipio_nome ?? "—"}
</div>


            <div>{chipOk(r.foto_url)}</div>
            <div>{chipOk(r.ficha_url)}</div>
            <div>{chipOk(r.doc_url)}</div>

            <div style={{ fontWeight: 800 }}>{r.status}</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {r.foto_url && (
                <a href={r.foto_url} target="_blank" rel="noreferrer">
                  Foto
                </a>
              )}
              {r.ficha_url && (
                <a href={r.ficha_url} target="_blank" rel="noreferrer">
                  Ficha
                </a>
              )}
              {r.doc_url && (
                <a href={r.doc_url} target="_blank" rel="noreferrer">
                  Doc
                </a>
              )}

              <button
                onClick={() => setStatus([r.id], "CONCLUIDO")}
                style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
              >
                Concluir
              </button>

              <button
                onClick={() => {
                  const obs = prompt("Observação para o gestor (opcional):") || "";
                  setStatus([r.id], "PENDENTE", obs);
                }}
                style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
              >
                Pend.
              </button>

              <button
                onClick={() => {
                  const obs = prompt("Motivo da rejeição (obrigatório):") || "";
                  if (!obs.trim()) return;
                  setStatus([r.id], "REJEITADO", obs.trim());
                }}
                style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
              >
                Rejeitar
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 && <div style={{ padding: 12 }}>Nenhum registro encontrado.</div>}
      </div>
    </main>
  );
}
