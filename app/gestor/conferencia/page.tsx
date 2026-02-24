"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number | null; municipio_id: number | null };

type Row = {
  id: number; // id do participante_arquivos
  participante_id: number | null;
  participante_nome: string | null;
  participante_tipo: string | null;

  escola_id: number | null;
  escola_nome: string | null;
  municipio_nome: string | null;

  status: "PENDENTE" | "CONCLUIDO" | "REJEITADO";
  observacao_admin: string | null;

  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;

  updated_at: string;
};

export default function GestorConferenciaPage() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [fStatus, setFStatus] = useState<Row["status"] | "">(""); // Todos
  const [fTipo, setFTipo] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  async function carregarPerfil() {
    setMsg("");
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      setLoading(false);
      setMsg("Você não está logado.");
      return;
    }

    // ✅ AJUSTE AQUI se sua tabela não for "perfis"
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id")
      .eq("user_id", userId)
      .single();

    setLoading(false);

    if (error) {
      setMsg("Erro ao carregar perfil: " + error.message);
      return;
    }

    setPerfil(data as Perfil);

    if (!data?.escola_id) {
      setMsg("Seu usuário não tem escola vinculada no perfil.");
      return;
    }
  }

  async function carregar() {
    if (!perfil?.escola_id) return;

    setMsg("");
    setLoading(true);

    // ✅ Aqui você pode usar a VIEW conferencia_itens se ela já junta os nomes
    // ou montar join na mão.
    // Vou usar sua view "conferencia_itens" porque você já tem.
    let q = supabase
      .from("conferencia_itens")
      .select(
        "id, participante_id, participante_nome, participante_tipo, escola_id, escola_nome, municipio_nome, status, observacao_admin, foto_url, ficha_url, doc_url, updated_at"
      )
      .eq("escola_id", perfil.escola_id)
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (fStatus) q = q.eq("status", fStatus);
    if (fTipo) q = q.eq("participante_tipo", fTipo);

    // busca por nome ou participante_id (se for número)
    const bid = Number(busca);
    if (busca.trim()) {
      if (!Number.isNaN(bid) && bid > 0) {
        q = q.eq("participante_id", bid);
      } else {
        // ilike depende de você ter "participante_nome" na view (você tem)
        q = q.ilike("participante_nome", `%${busca.trim()}%`);
      }
    }

    const { data, error } = await q;

    setLoading(false);

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    carregarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!perfil?.escola_id) return;
    const t = setTimeout(() => carregar(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.escola_id, fStatus, fTipo, busca]);

  const contagem = useMemo(() => {
    const total = rows.length;
    const pend = rows.filter((r) => r.status === "PENDENTE").length;
    const conc = rows.filter((r) => r.status === "CONCLUIDO").length;
    const rej = rows.filter((r) => r.status === "REJEITADO").length;
    return { total, pend, conc, rej };
  }, [rows]);

  const styles = {
    card: { border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" } as React.CSSProperties,
    tiny: { fontSize: 12, opacity: 0.8 } as React.CSSProperties,
    tableWrap: { marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: "#fff" } as React.CSSProperties,
    head: {
      display: "grid",
      gridTemplateColumns: "80px 110px 1.6fr 1.6fr 170px 130px 340px",
      padding: "12px 12px",
      background: "#fafafa",
      fontWeight: 800,
      borderBottom: "1px solid #eee",
      alignItems: "center",
    } as React.CSSProperties,
    row: {
      display: "grid",
      gridTemplateColumns: "80px 110px 1.6fr 1.6fr 170px 130px 340px",
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
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Gestor • Conferência</h1>

      {msg && <div style={{ ...styles.card, marginTop: 10 }}>{msg}</div>}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={styles.card}>Total: <b>{contagem.total}</b></div>
        <div style={styles.card}>Pendentes: <b>{contagem.pend}</b></div>
        <div style={styles.card}>Concluídos: <b>{contagem.conc}</b></div>
        <div style={styles.card}>Rejeitados: <b>{contagem.rej}</b></div>
      </div>

      {/* filtros */}
      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 2fr", alignItems: "end" }}>
        <div>
          <div style={styles.tiny}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="PENDENTE">PENDENTE</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="REJEITADO">REJEITADO</option>
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
          <div style={styles.tiny}>Buscar (nome ou participante_id)</div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="ex: Maria / 1234"
            style={{ padding: 10, width: "100%" }}
          />
        </div>
      </div>

      {loading && <div style={{ marginTop: 10, opacity: 0.8 }}>Carregando...</div>}

      {/* tabela */}
      <div style={styles.tableWrap}>
        <div style={styles.head}>
          <div>#</div>
          <div>Tipo</div>
          <div>Participante</div>
          <div>Escola</div>
          <div>Arquivos</div>
          <div>Status</div>
          <div>Motivo / Observação</div>
        </div>

        {rows.map((r) => (
          <div key={r.id} style={styles.row}>
            <div><b>{r.id}</b></div>
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

            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {r.observacao_admin?.trim() ? r.observacao_admin : "—"}
            </div>
          </div>
        ))}

        {rows.length === 0 && <div style={{ padding: 12 }}>Nenhum registro encontrado.</div>}
      </div>
    </main>
  );
}