"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Pendencia = {
  id: number;
  participante_tipo: string;
  participante_id: number;
  escola_id: number;
  status: "PENDENTE" | "CONCLUIDO";
  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;
  observacao: string | null;
  escolas?: { nome: string; municipios?: { nome: string } };
};

type Escola = { id: number; nome: string };
type Municipio = { id: number; nome: string };

export default function AdminPendenciasPage() {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [msg, setMsg] = useState("");

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [fMunicipio, setFMunicipio] = useState("");
  const [fEscola, setFEscola] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fTipo, setFTipo] = useState("");

  async function carregarBase() {
    const m = await supabase.from("municipios").select("id, nome").order("nome");
    setMunicipios((m.data ?? []) as any);

    const e = await supabase.from("escolas").select("id, nome").order("nome");
    setEscolas((e.data ?? []) as any);
  }

  async function carregarPendencias() {
    setMsg("Carregando...");
    let query = supabase
      .from("participante_arquivos")
      .select(`
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
      `)
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

    let lista = data ?? [];

    if (fMunicipio) {
      lista = lista.filter(
        (x: any) => String(x.escolas?.municipios?.nome) === fMunicipio
      );
    }

    setPendencias(lista as any);
    setMsg("");
  }

  async function devolver(p: Pendencia) {
    const obs = prompt("Informe o motivo da devolução:");
    if (!obs) return;

    const { error } = await supabase
      .from("participante_arquivos")
      .update({ observacao: obs, status: "PENDENTE" })
      .eq("id", p.id);

    if (error) {
      alert(error.message);
      return;
    }

    carregarPendencias();
  }

  useEffect(() => {
    carregarBase();
    carregarPendencias();
  }, []);

  useEffect(() => {
    carregarPendencias();
  }, [fMunicipio, fEscola, fStatus, fTipo]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>
        Admin • Pendências de Documentação
      </h1>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee" }}>
          {msg}
        </div>
      )}

      {/* Filtros */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        <select value={fMunicipio} onChange={(e) => setFMunicipio(e.target.value)}>
          <option value="">Município</option>
          {municipios.map((m) => (
            <option key={m.id} value={m.nome}>
              {m.nome}
            </option>
          ))}
        </select>

        <select value={fEscola} onChange={(e) => setFEscola(e.target.value)}>
          <option value="">Escola</option>
          {escolas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>

        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Tipo</option>
          <option value="ATLETA">Atleta</option>
          <option value="TECNICO">Técnico</option>
          <option value="OFICIAL">Oficial</option>
          <option value="CHEFE">Chefe</option>
        </select>

        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="CONCLUIDO">Concluído</option>
        </select>
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
              gridTemplateColumns: "1.5fr 1fr 1fr 2fr 160px",
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

            <div>{p.status}</div>

            <div style={{ display: "flex", gap: 8 }}>
              {p.foto_url && <a href={p.foto_url} target="_blank">Foto</a>}
              {p.ficha_url && <a href={p.ficha_url} target="_blank">Ficha</a>}
              {p.doc_url && <a href={p.doc_url} target="_blank">Doc</a>}
            </div>

            <div style={{ fontSize: 12 }}>
              {p.observacao ? `Obs: ${p.observacao}` : "—"}
            </div>

            <button onClick={() => devolver(p)}>Devolver</button>
          </div>
        ))}

        {pendencias.length === 0 && (
          <div style={{ padding: 14 }}>Nenhuma pendência encontrada.</div>
        )}
      </div>
    </main>
  );
}
