"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Row = {
  id: number;
  equipe_id: number;
  atleta_saida_id: number;
  atleta_entrada_id: number;
  motivo: string | null;
  laudo_url: string | null;
  status: string; // vamos tratar string pra não travar com valores antigos
  observacao_admin: string | null;
  created_at: string;

  // joins
  equipes?: { id: number; nome: string | null };
  atleta_saida?: { id: number; nome: string | null };
  atleta_entrada?: { id: number; nome: string | null };
};

export default function AdminSubstituicoesPage() {
  const [msg, setMsg] = useState("");
  const [lista, setLista] = useState<Row[]>([]);

  async function carregar() {
    setMsg("");

    const { data, error } = await supabase
      .from("substituicoes")
      .select(`
        id,
        equipe_id,
        atleta_saida_id,
        atleta_entrada_id,
        motivo,
        laudo_url,
        status,
        observacao_admin,
        created_at,
        equipes:equipes ( id, nome ),
        atleta_saida:atletas!substituicoes_atleta_saida_id_fkey ( id, nome ),
        atleta_entrada:atletas!substituicoes_atleta_entrada_id_fkey ( id, nome )
      `)
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro: " + error.message);
    setLista((data ?? []) as any);
  }

  async function aprovar(id: number) {
    setMsg("");

    const r = await fetch("/api/substituicoes/aprovar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ substituicao_id: id }),
    });

    const j = await r.json();
    if (!r.ok) return setMsg("Erro ao aprovar: " + (j.error ?? "erro"));

    setMsg("Aprovada ✅ (troca aplicada)");
    carregar();
  }

  async function rejeitar(id: number) {
    setMsg("");
    const obs = prompt("Motivo para rejeitar?") || "";

    const r = await fetch("/api/substituicoes/rejeitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ substituicao_id: id, observacao_admin: obs }),
    });

    const j = await r.json();
    if (!r.ok) return setMsg("Erro ao rejeitar: " + (j.error ?? "erro"));

    setMsg("Rejeitada ✅");
    carregar();
  }

  function isPendente(status: string) {
    return status === "PENDENTE_APROVACAO" || status === "PENDENTE";
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Substituições</h1>
      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10 }}>
        {lista.map((s) => (
          <div
            key={s.id}
            style={{
              padding: 12,
              borderBottom: "1px solid #eee",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              #{s.id} • {s.equipes?.nome ? s.equipes.nome : `Equipe ${s.equipe_id}`} • {s.status}
            </div>

            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Sai: <b>{s.atleta_saida?.nome ?? `#${s.atleta_saida_id}`}</b> → Entra:{" "}
              <b>{s.atleta_entrada?.nome ?? `#${s.atleta_entrada_id}`}</b>
            </div>

            {s.motivo ? <div style={{ fontSize: 13, opacity: 0.9 }}>Motivo: {s.motivo}</div> : null}

            {s.laudo_url ? (
              <div>
                <a href={s.laudo_url} target="_blank" rel="noreferrer">
                  Abrir laudo
                </a>
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.8 }}>Sem laudo anexado</div>
            )}

            {s.observacao_admin ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>Obs admin: {s.observacao_admin}</div>
            ) : null}

            {isPendente(s.status) && (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => aprovar(s.id)} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                  Aprovar
                </button>
                <button onClick={() => rejeitar(s.id)} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                  Rejeitar
                </button>
              </div>
            )}
          </div>
        ))}

        {lista.length === 0 && <div style={{ padding: 12 }}>Nenhuma solicitação.</div>}
      </div>
    </main>
  );
}
