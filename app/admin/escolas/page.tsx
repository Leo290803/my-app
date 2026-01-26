"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Municipio = { id: number; nome: string };
type Escola = { id: number; nome: string; ativo: boolean; municipio_id: number; municipios?: { nome: string } };

export default function EscolasPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [municipioId, setMunicipioId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");

  async function carregarMunicipios() {
    const { data, error } = await supabase
      .from("municipios")
      .select("id, nome")
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar municípios: " + error.message);
      return;
    }
    setMunicipios(data ?? []);
  }

async function carregarEscolas() {
  const { data, error } = await supabase
    .from("escolas")
    .select(`
      id,
      nome,
      ativo,
      municipio_id,
      municipios (
        nome
      )
    `)
    .order("nome");

  if (error) {
    setMsg("Erro ao carregar escolas: " + error.message);
    return;
  }

  const rows = (data ?? []) as unknown as Escola[];
  setEscolas(rows);
}

  async function adicionar() {
    setMsg("");

    const mid = Number(municipioId);
    if (!mid) {
      setMsg("Selecione um município.");
      return;
    }
    if (!nome.trim()) {
      setMsg("Informe o nome da escola.");
      return;
    }

    const { error } = await supabase.from("escolas").insert({
      municipio_id: mid,
      nome: nome.trim(),
      ativo: true,
    });

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setNome("");
    setMsg("Escola cadastrada ✅");
    carregarEscolas();
  }

  useEffect(() => {
    carregarMunicipios();
    carregarEscolas();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Escolas</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
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
          placeholder="Nome da escola"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <button
          onClick={adicionar}
          style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
        >
          Adicionar
        </button>

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Lista</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {escolas.map((e) => (
          <div
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 120px",
              gap: 10,
              padding: 12,
              borderBottom: "1px solid #eee",
            }}
          >
            <span>{e.nome}</span>
            <span>{e.municipios?.nome ?? "—"}</span>
            <span>{e.ativo ? "Ativo" : "Inativo"}</span>
          </div>
        ))}
        {escolas.length === 0 && <div style={{ padding: 12 }}>Nenhuma escola cadastrada.</div>}
      </div>
    </main>
  );
}
