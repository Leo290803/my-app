"use client";

import { useEffect, useMemo, useState } from "react";
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

  // edição inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  async function carregar() {
    setMsg("");
    const { data, error } = await supabase
      .from("municipios")
      .select("id, nome, ativo")
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      return;
    }
    setLista((data ?? []) as Municipio[]);
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

  function iniciarEdicao(m: Municipio) {
    setMsg("");
    setEditId(m.id);
    setEditNome(m.nome ?? "");
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
  }

  async function salvarEdicao(m: Municipio) {
    const novo = editNome.trim();
    if (!novo) return setMsg("Informe o nome do município.");

    setMsg("");
    setSalvandoId(m.id);

    const { error } = await supabase
      .from("municipios")
      .update({ nome: novo })
      .eq("id", m.id);

    setSalvandoId(null);

    if (error) return setMsg("Erro ao editar: " + error.message);

    setLista((prev) => prev.map((x) => (x.id === m.id ? { ...x, nome: novo } : x)));
    setMsg("Município atualizado ✅");
    cancelarEdicao();
  }

  async function excluirMunicipio(m: Municipio) {
    const ok = window.confirm(
      `Excluir de verdade o município "${m.nome}"?\n\nATENÇÃO: Só será permitido se não existir nenhuma escola vinculada.`
    );
    if (!ok) return;

    setMsg("");
    setExcluindoId(m.id);

    // 1) checa se existem escolas usando esse municipio
    const { data: escolas, error: eErr } = await supabase
      .from("escolas")
      .select("id")
      .eq("municipio_id", m.id)
      .limit(1);

    if (eErr) {
      setExcluindoId(null);
      return setMsg("Erro ao verificar escolas vinculadas: " + eErr.message);
    }

    if ((escolas ?? []).length > 0) {
      setExcluindoId(null);
      return setMsg(
        `Não posso excluir "${m.nome}" porque existe pelo menos 1 escola vinculada.\n\nPrimeiro altere o município dessas escolas (ou apague as escolas).`
      );
    }

    // 2) pode excluir
    const { error } = await supabase.from("municipios").delete().eq("id", m.id);

    setExcluindoId(null);

    if (error) {
      return setMsg("Erro ao excluir: " + error.message);
    }

    setLista((prev) => prev.filter((x) => x.id !== m.id));
    setMsg("Município excluído ✅");
  }

  useEffect(() => {
    carregar();
  }, []);

  const ordenada = useMemo(() => lista, [lista]);

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
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

      {msg && (
        <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
          {msg}
        </pre>
      )}

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Lista</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {ordenada.map((m) => {
          const emEdicao = editId === m.id;

          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 220px",
                gap: 10,
                alignItems: "center",
                padding: 12,
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ minWidth: 0 }}>
                {emEdicao ? (
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                ) : (
                  <span style={{ fontWeight: 600 }}>{m.nome}</span>
                )}
              </div>

              <span>{m.ativo ? "Ativo" : "Inativo"}</span>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {emEdicao ? (
                  <>
                    <button
                      onClick={() => salvarEdicao(m)}
                      disabled={salvandoId === m.id}
                      style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
                      title="Salvar"
                    >
                      {salvandoId === m.id ? "Salvando..." : "Salvar"}
                    </button>

                    <button
                      onClick={cancelarEdicao}
                      style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
                      title="Cancelar"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => iniciarEdicao(m)}
                      style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
                      title="Editar"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => excluirMunicipio(m)}
                      disabled={excluindoId === m.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: "#fee2e2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                      }}
                      title="Excluir de verdade"
                    >
                      {excluindoId === m.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {lista.length === 0 && <div style={{ padding: 12 }}>Nenhum município cadastrado.</div>}
      </div>
    </main>
  );
}