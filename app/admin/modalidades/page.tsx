"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Modalidade = {
  id: number;
  nome: string;
  tipo: "INDIVIDUAL" | "COLETIVA";
};

export default function AdminModalidadesPage() {
  const [lista, setLista] = useState<Modalidade[]>([]);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"INDIVIDUAL" | "COLETIVA">("COLETIVA");
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data, error } = await supabase
      .from("modalidades")
      .select("id, nome, tipo")
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      return;
    }
    setLista((data ?? []) as unknown as Modalidade[]);
  }

  async function adicionar() {
    setMsg("");
    if (!nome.trim()) {
      setMsg("Informe o nome da modalidade.");
      return;
    }

    const { error } = await supabase.from("modalidades").insert({
      nome: nome.trim(),
      tipo,
    });

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setNome("");
    setMsg("Modalidade cadastrada ✅");
    carregar();
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Modalidades</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 520 }}>
        <input
          placeholder="Nome (ex: Atletismo, Futsal, Natação)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="COLETIVA">COLETIVA</option>
          <option value="INDIVIDUAL">INDIVIDUAL</option>
        </select>

        <button onClick={adicionar} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Adicionar
        </button>

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>Lista</h2>
      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {lista.map((m) => (
          <div
            key={m.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 160px",
              gap: 10,
              padding: 12,
              borderBottom: "1px solid #eee",
            }}
          >
            <span>{m.nome}</span>
            <span>{m.tipo}</span>
          </div>
        ))}
        {lista.length === 0 && <div style={{ padding: 12 }}>Nenhuma modalidade cadastrada.</div>}
      </div>
    </main>
  );
}
