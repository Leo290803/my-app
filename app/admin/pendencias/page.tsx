"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type StatusDoc = "PENDENTE" | "CONCLUIDO" | "DEVOLVIDO";

type Pendencia = {
  id: number;
  participante_tipo: string;
  participante_id: number;
  escola_id: number;
  status: StatusDoc;
  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;
  observacao: string | null;
  escolas?: { nome: string; municipios?: { nome: string } };
};

type Escola = { id: number; nome: string; municipio_id?: number };
type Municipio = { id: number; nome: string };

export default function AdminPendenciasPage() {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [msg, setMsg] = useState("");

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [fMunicipio, setFMunicipio] = useState("");
  const [fEscola, setFEscola] = useState("");
  const [fStatus, setFStatus] = useState<"" | StatusDoc>("PENDENTE"); // ✅ padrão: só pendentes
  const [fTipo, setFTipo] = useState("");

  async function carregarBase() {
    const m = await supabase.from("municipios").select("id, nome").order("nome");
    setMunicipios((m.data ?? []) as any);

    // Se tiver municipio_id em escolas, melhor selecionar também
    const e = await supabase.from("escolas").select("id, nome, municipio_id").order("nome");
    setEscolas((e.data ?? []) as any);
  }

  async function carregarPendencias() {
    setMsg("Carregando...");

    let query = supabase
      .from("participante_arquivos")
      .select(
        `
        id,
        participante_tipo,
        participante_id,
        escola_id,
        status,
        foto_url,
        ficha_url,
        doc_url,
        observacao,
        escolas (
          nome,
          municipios ( nome )
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (fStatus) query = query.eq("status", fStatus);
    if (fTipo) query = query.eq("participante_tipo", fTipo);
    if (fEscola) query = query.eq("escola_id", Number(fEscola));

    const { data, error } = await query;

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      return;
    }

    let lista = (data ?? []) as any[];

    // filtro por município (pois município vem via JOIN e não por coluna direta)
    if (fMunicipio) {
      lista = lista.filter((x: any) => String(x.escolas?.municipios?.nome) === fMunicipio);
    }

    setPendencias(lista as any);
    setMsg(`OK: ${lista.length} item(ns)`);
  }

  async function devolver(p: Pendencia) {
    const obs = prompt("Informe o motivo da devolução:");
    if (!obs) return;

    setMsg("Devolvendo...");

    const { error } = await supabase
      .from("participante_arquivos")
      .update({
        observacao: obs,
        status: "DEVOLVIDO", // ✅ aqui é o segredo: não fica mais PENDENTE
      })
      .eq("id", p.id);

    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }

    // ✅ some da tela na hora (principalmente se fStatus = PENDENTE)
    setPendencias((prev) => prev.filter((x) => x.id !== p.id));
    setMsg("Devolvido ✅");
  }

  // (Opcional) botão para marcar concluído, se você quiser
  async function concluir(p: Pendencia) {
    setMsg("Marcando concluído...");
    const { error } = await supabase
      .from("participante_arquivos")
      .update({ status: "CONCLUIDO" })
      .eq("id", p.id);

    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }

    setPendencias((prev) => prev.filter((x) => x.id !== p.id));
    setMsg("Concluído ✅");
  }

  useEffect(() => {
    carregarBase();
    carregarPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fMunicipio, fEscola, fStatus, fTipo]);

  const statusLabel = (s: StatusDoc) => {
    if (s === "PENDENTE") return "PENDENTE";
    if (s === "CONCLUIDO") return "CONCLUÍDO";
    return "DEVOLVIDO";
  };

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Admin • Pendências de Documentação</h1>

      {msg && <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee" }}>{msg}</div>}

      {/* Filtros */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Município</div>
          <select value={fMunicipio} onChange={(e) => setFMunicipio(e.target.value)} style={{ width: "100%", padding: 10 }}>
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.nome}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Escola</div>
          <select value={fEscola} onChange={(e) => setFEscola(e.target.value)} style={{ width: "100%", padding: 10 }}>
            <option value="">Todas</option>
            {escolas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Tipo</div>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ width: "100%", padding: 10 }}>
            <option value="">Todos</option>
            <option value="ATLETA">Atleta</option>
            <option value="TECNICO">Técnico</option>
            <option value="OFICIAL">Oficial</option>
            <option value="CHEFE">Chefe</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} style={{ width: "100%", padding: 10 }}>
            <option value="">Todos</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="CONCLUIDO">Concluídos</option>
            <option value="DEVOLVIDO">Devolvidos</option>
          </select>
        </div>

        <button onClick={carregarPendencias} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Atualizar
        </button>
      </div>

      {/* Lista */}
      <div style={{ marginTop: 14, border: "1px solid #eee" }}>
        {pendencias.map((p) => (
          <div
            key={p.id}
            style={{
              borderTop: "1px solid #eee",
              padding: 12,
              display: "grid",
              gridTemplateColumns: "1.6fr 0.8fr 1fr 2fr 220px",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div>
              <b>{p.participante_tipo}</b> #{p.participante_id}
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {p.escolas?.nome} — {p.escolas?.municipios?.nome}
              </div>
            </div>

            <div>{statusLabel(p.status)}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.foto_url && (
                <a href={p.foto_url} target="_blank" rel="noreferrer">
                  Foto
                </a>
              )}
              {p.ficha_url && (
                <a href={p.ficha_url} target="_blank" rel="noreferrer">
                  Ficha
                </a>
              )}
              {p.doc_url && (
                <a href={p.doc_url} target="_blank" rel="noreferrer">
                  Doc
                </a>
              )}
            </div>

            <div style={{ fontSize: 12 }}>{p.observacao ? `Obs: ${p.observacao}` : "—"}</div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => devolver(p)} style={{ padding: "8px 12px" }}>
                Devolver
              </button>

              <button onClick={() => concluir(p)} style={{ padding: "8px 12px" }}>
                Concluir
              </button>
            </div>
          </div>
        ))}

        {pendencias.length === 0 && <div style={{ padding: 14 }}>Nenhuma pendência encontrada.</div>}
      </div>
    </main>
  );
}
