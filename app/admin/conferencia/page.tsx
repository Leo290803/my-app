"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Escola = {
  id: number;
  nome: string;
  municipio_id: number | null;
  municipios?: { nome: string } | null;
};

type Municipio = { id: number; nome: string };

type Row = {
  id: number; // id da linha em participante_arquivos (via view conferencia_itens)
  participante_tipo: string | null; // ATLETA / TECNICO / OFICIAL / CHEFE / etc
  participante_id: number | null;
  escola_id: number | null;

  status: "PENDENTE" | "CONCLUIDO" | "REJEITADO";

  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;

  observacao: string | null;
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
  const [fStatus, setFStatus] = useState<Row["status"] | "">("PENDENTE"); // padrão
  const [buscaId, setBuscaId] = useState<string>(""); // busca por participante_id

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
    // NÃO limpa msg aqui pra não "apagar" feedback enquanto carrega filtros
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
    setLoading(true);
    setSelecionados(new Set());

    const mid = Number(fMunicipio);
    const eid = Number(fEscola);

    // escolas do município (pra filtrar no banco com .in)
    const escolasDoMunicipioIds =
      mid && !eid ? escolas.filter((x) => x.municipio_id === mid).map((x) => x.id) : [];

    let q = supabase
      .from("conferencia_itens")
      .select(
        "id, participante_tipo, participante_id, participante_nome, escola_id, escola_nome, municipio_nome, status, foto_url, ficha_url, doc_url, observacao, observacao_admin, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(500);

    if (eid) q = q.eq("escola_id", eid);

    // ✅ se escolheu município e não escolheu escola: filtra direto no banco
    if (mid && !eid) {
      if (escolasDoMunicipioIds.length === 0) {
        setRows([]);
        setLoading(false);
        setMsg("Nenhuma escola encontrada para esse município.");
        return;
      }
      q = q.in("escola_id", escolasDoMunicipioIds);
    }

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

    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  async function setStatus(ids: number[], status: Row["status"], obsAdmin?: string) {
  if (ids.length === 0) {
    setMsg("Selecione pelo menos 1 item.");
    return;
  }

  setMsg("");
  setLoading(true);

  const payload: any = { status, observacao_admin: obsAdmin ?? null };

  const { data, error } = await supabase
    .from("participante_arquivos")
    .update(payload)
    .in("id", ids)
    .select("id, status");

  setLoading(false);

  if (error) {
    setMsg("Erro ao atualizar: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    setMsg("Não atualizou nada. Provável: RLS bloqueando UPDATE na tabela participante_arquivos.");
    return;
  }

  // ✅ Atualiza a UI imediatamente (mesmo que a VIEW não reflita)
  setRows((prev) =>
    prev.map((r) =>
      ids.includes(r.id)
        ? {
            ...r,
            status,
            observacao_admin: obsAdmin ?? null,
            updated_at: new Date().toISOString(),
          }
        : r
    )
  );

  // ✅ Se estava filtrando PENDENTE e mudou pra outro status, mostra "Todos"
  if (fStatus === "PENDENTE" && status !== "PENDENTE") {
    setFStatus(""); // Todos
  }

  // (Opcional) recarregar pra garantir consistência
  await carregar();

  setMsg(`Atualizado ✅ (${data.length}) → ${status}`);
}

  async function concluirSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return setMsg("Selecione pelo menos 1 item.");
    if (!confirm(`Marcar ${ids.length} item(ns) como CONCLUÍDO?`)) return;
    await setStatus(ids, "CONCLUIDO");
  }

  async function devolverPendenciaSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return setMsg("Selecione pelo menos 1 item.");
    const obs = prompt("Observação para o gestor (opcional):") || "";
    if (!confirm(`Voltar ${ids.length} item(ns) para PENDENTE?`)) return;
    await setStatus(ids, "PENDENTE", obs);
  }

  async function rejeitarSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return setMsg("Selecione pelo menos 1 item.");
    const obs = prompt("Motivo da rejeição (obrigatório):") || "";
    if (!obs.trim()) return setMsg("Informe o motivo da rejeição.");
    if (!confirm(`Marcar ${ids.length} item(ns) como REJEITADO?`)) return;
    await setStatus(ids, "REJEITADO", obs.trim());
  }

  useEffect(() => {
    carregarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => carregar(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fMunicipio, fEscola, fTipo, fStatus, buscaId, escolas.length]);

  const styles = {
    card: { border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" } as React.CSSProperties,
    tiny: { fontSize: 12, opacity: 0.8 } as React.CSSProperties,
    btn: { padding: 10, borderRadius: 10, cursor: "pointer" } as React.CSSProperties,
    btnSm: { padding: "8px 10px", borderRadius: 10, cursor: "pointer" } as React.CSSProperties,
    tableWrap: { marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: "#fff" } as React.CSSProperties,
    head: {
      display: "grid",
      gridTemplateColumns: "78px 100px 1.4fr 1.6fr 150px 120px 320px",
      gap: 0,
      padding: "12px 12px",
      background: "#fafafa",
      fontWeight: 800,
      borderBottom: "1px solid #eee",
      alignItems: "center",
    } as React.CSSProperties,
    row: {
      display: "grid",
      gridTemplateColumns: "78px 100px 1.4fr 1.6fr 150px 120px 320px",
      padding: "12px 12px",
      borderBottom: "1px solid #eee",
      alignItems: "center",
    } as React.CSSProperties,
    badge: (status: Row["status"]) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid #eee",
        background: status === "PENDENTE" ? "#fff7ed" : status === "CONCLUIDO" ? "#ecfdf5" : "#fef2f2",
      }) as React.CSSProperties,
    linkPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #eee",
      fontSize: 12,
      textDecoration: "none",
      color: "#111827",
      background: "#fff",
    } as React.CSSProperties,
  };

  function arquivosCell(r: Row) {
    const itens: Array<{ label: string; url: string | null }> = [
      { label: "Foto", url: r.foto_url },
      { label: "Ficha", url: r.ficha_url },
      { label: "Doc", url: r.doc_url },
    ];

    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {itens.map((it) =>
          it.url ? (
            <a key={it.label} href={it.url} target="_blank" rel="noreferrer" style={styles.linkPill}>
              ✅ {it.label}
            </a>
          ) : (
            <span key={it.label} style={{ ...styles.linkPill, opacity: 0.5 }}>
              — {it.label}
            </span>
          )
        )}
      </div>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1400 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Admin • Conferência (Pendências)</h1>

      {msg && <div style={{ ...styles.card, marginTop: 10 }}>{msg}</div>}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={styles.card}>
          Total: <b>{contagem.total}</b>
        </div>
        <div style={styles.card}>
          Pendentes: <b>{contagem.pend}</b>
        </div>
        <div style={styles.card}>
          Concluídos: <b>{contagem.conc}</b>
        </div>
        <div style={styles.card}>
          Rejeitados: <b>{contagem.rej}</b>
        </div>
      </div>

      {/* filtros */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1.1fr 1.3fr 1fr 1fr 1fr",
          alignItems: "end",
        }}
      >
        <div>
          <div style={styles.tiny}>Município</div>
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
          <div style={styles.tiny}>Escola</div>
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
          <div style={styles.tiny}>Tipo</div>
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
          <div style={styles.tiny}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} style={{ padding: 10, width: "100%" }}>
            <option value="PENDENTE">PENDENTE</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="REJEITADO">REJEITADO</option>
            <option value="">Todos</option>
          </select>
        </div>

        <div>
          <div style={styles.tiny}>Buscar por participante_id</div>
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
        <button onClick={selectAllCurrent} style={styles.btn}>
          Selecionar todos da tela
        </button>
        <button onClick={clearSelection} style={styles.btn}>
          Limpar seleção
        </button>

        <div style={styles.card}>
          Selecionados: <b>{selecionados.size}</b>
        </div>

        <button type="button" onClick={concluirSelecionados} style={styles.btn}>
          Marcar CONCLUÍDO ✅
        </button>
        <button type="button" onClick={devolverPendenciaSelecionados} style={styles.btn}>
          Voltar para PENDENTE ↩️
        </button>
        <button type="button" onClick={rejeitarSelecionados} style={styles.btn}>
          Marcar REJEITADO ❌
        </button>

        <button type="button" onClick={carregar} style={styles.btn}>
          Recarregar
        </button>

        {loading && <span style={{ opacity: 0.8 }}>Carregando...</span>}
      </div>

      {/* tabela */}
      <div style={styles.tableWrap}>
        <div style={styles.head}>
          <div>#</div>
          <div>Tipo</div>
          <div>Participante</div>
          <div>Escola</div>
          <div>Arquivos</div>
          <div>Status</div>
          <div>Ações</div>
        </div>

        {rows.map((r) => {
          const selected = selecionados.has(r.id);
          return (
            <div
              key={r.id}
              style={{
                ...styles.row,
                background: selected ? "#f0f9ff" : "#fff",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={selected} onChange={() => toggleSel(r.id)} />
                <b>{r.id}</b>
              </div>

              <div>{r.participante_tipo ?? "—"}</div>

              <div>
                <div style={{ fontWeight: 900 }}>{r.participante_nome ?? `ID ${r.participante_id ?? "—"}`}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>participante_id: {r.participante_id ?? "—"}</div>
              </div>

              <div>
                <div style={{ fontWeight: 900 }}>{r.escola_nome ?? "—"}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{r.municipio_nome ?? "—"}</div>
              </div>

              <div>{arquivosCell(r)}</div>

              <div>
                <span style={styles.badge(r.status)}>{r.status}</span>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setStatus([r.id], "CONCLUIDO")} style={styles.btnSm}>
                  Concluir
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const obs = prompt("Observação para o gestor (opcional):") || "";
                    setStatus([r.id], "PENDENTE", obs);
                  }}
                  style={styles.btnSm}
                >
                  Pend.
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const obs = prompt("Motivo da rejeição (obrigatório):") || "";
                    if (!obs.trim()) return;
                    setStatus([r.id], "REJEITADO", obs.trim());
                  }}
                  style={styles.btnSm}
                >
                  Rejeitar
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && <div style={{ padding: 12 }}>Nenhum registro encontrado.</div>}
      </div>
    </main>
  );
}