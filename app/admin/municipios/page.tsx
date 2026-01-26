"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Municipio = {
  id: number;
  nome: string;
  ativo: boolean;
};

export default function MunicipiosPage() {
  const [lista, setLista] = useState<Municipio[]>([]);
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data, error } = await supabase
      .from("municipios")
      .select("id, nome, ativo")
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      return;
    }
    setLista(data ?? []);
  }

  async function adicionar() {
    setMsg("");
    if (!nome.trim()) {
      setMsg("Informe o nome do município.");
      return;
    }

    const { error } = await supabase.from("municipios").insert({
      nome: nome.trim(),
      ativo: true,
    });

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setNome("");
    setMsg("Município cadastrado ✅");
    carregar();
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Municípios</h1>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input
          placeholder="Nome do município"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <button
          onClick={adicionar}
          style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
        >
          Adicionar
        </button>
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Lista</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {lista.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 12,
              borderBottom: "1px solid #eee",
            }}
          >
            <span>{m.nome}</span>
            <span>{m.ativo ? "Ativo" : "Inativo"}</span>
          </div>
        ))}
        {lista.length === 0 && <div style={{ padding: 12 }}>Nenhum município cadastrado.</div>}
      </div>
    </main>
  );
}
