"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Municipio = { id: number; nome: string };

type Evento = {
  id: number;
  nome: string;
  status: "ABERTO" | "ENCERRADO";
  municipio_id: number;
  inscricoes_abertas: boolean;
  municipios: { nome: string } | null;
};

export default function AdminEventosPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [msg, setMsg] = useState("");

  const [municipioId, setMunicipioId] = useState<string>("");
  const [nome, setNome] = useState("");

  async function carregarMunicipios() {
    const { data, error } = await supabase.from("municipios").select("id, nome").order("nome");
    if (error) {
      setMsg("Erro municípios: " + error.message);
      return;
    }
    setMunicipios((data ?? []) as unknown as Municipio[]);
  }

  async function carregarEventos() {
    const { data, error } = await supabase
      .from("eventos")
      .select(
        `
        id,
        nome,
        status,
        municipio_id,
        inscricoes_abertas,
        municipios ( nome )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("Erro eventos: " + error.message);
      return;
    }
    setEventos((data ?? []) as unknown as Evento[]);
  }

  async function adicionar() {
    setMsg("");
    const mid = Number(municipioId);
    if (!mid) return setMsg("Selecione o município do evento.");
    if (!nome.trim()) return setMsg("Informe o nome do evento.");

    const { error } = await supabase.from("eventos").insert({
      nome: nome.trim(),
      municipio_id: mid,
      status: "ABERTO",
      inscricoes_abertas: true,
    });

    if (error) return setMsg("Erro ao salvar: " + error.message);

    setNome("");
    setMunicipioId("");
    setMsg("Evento criado ✅");
    carregarEventos();
  }

  async function toggleInscricoes(eventoId: number, abrir: boolean) {
    setMsg("");

    const { error } = await supabase
      .from("eventos")
      .update({ inscricoes_abertas: abrir })
      .eq("id", eventoId);

    if (error) return setMsg("Erro ao atualizar: " + error.message);

    setMsg(abrir ? "Inscrições reabertas ✅" : "Inscrições fechadas ✅");
    carregarEventos();
  }

  useEffect(() => {
    carregarMunicipios();
    carregarEventos();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Eventos</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 620 }}>
        <select
          value={municipioId}
          onChange={(e) => setMunicipioId(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="">Selecione o município...</option>
          {municipios.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>

        <input
          placeholder='Nome do evento (ex: "JERS 2026 – Fase Municipal Caracaraí")'
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <button onClick={adicionar} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Criar evento
        </button>

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>Lista</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {eventos.map((e) => (
          <div
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 220px 140px 120px",
              gap: 10,
              padding: 12,
              borderBottom: "1px solid #eee",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{e.nome}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Município: {e.municipios ? e.municipios.nome : "—"}
              </div>
            </div>

            <span>{e.status}</span>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>
                {e.inscricoes_abertas ? "ABERTAS" : "FECHADAS"}
              </span>

              {e.inscricoes_abertas ? (
                <button
                  onClick={() => toggleInscricoes(e.id, false)}
                  style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
                >
                  Fechar
                </button>
              ) : (
                <button
                  onClick={() => toggleInscricoes(e.id, true)}
                  style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
                >
                  Reabrir
                </button>
              )}
            </div>

            <Link href={`/admin/eventos/${e.id}/configurar`}>Configurar</Link>

            <span>ID: {e.id}</span>
          </div>
        ))}
        {eventos.length === 0 && <div style={{ padding: 12 }}>Nenhum evento criado.</div>}
      </div>
    </main>
  );
}
