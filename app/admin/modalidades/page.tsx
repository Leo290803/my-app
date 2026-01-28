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

  const [carregando, setCarregando] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // edição inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTipo, setEditTipo] = useState<"INDIVIDUAL" | "COLETIVA">("COLETIVA");
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  // excluir
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  async function carregar(silencioso = false) {
    if (!silencioso) setMsg("");
    setCarregando(true);

    const { data, error } = await supabase
      .from("modalidades")
      .select("id, nome, tipo")
      .order("nome");

    setCarregando(false);

    if (error) {
      setMsg("Erro ao carregar: " + error.message);
      return;
    }
    setLista((data ?? []) as Modalidade[]);
  }

  async function adicionar() {
    setMsg("");
    const n = nome.trim();
    if (!n) return setMsg("Informe o nome da modalidade.");

    setSalvandoNovo(true);

    const { error } = await supabase.from("modalidades").insert({
      nome: n,
      tipo,
    });

    setSalvandoNovo(false);

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setNome("");
    setTipo("COLETIVA");
    setMsg("Modalidade cadastrada ✅");
    carregar(true);
  }

  function iniciarEdicao(m: Modalidade) {
    setMsg("");
    setEditId(m.id);
    setEditNome(m.nome);
    setEditTipo(m.tipo);
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
    setEditTipo("COLETIVA");
  }

  async function salvarEdicao() {
    if (!editId) return;

    setMsg("");
    const n = editNome.trim();
    if (!n) return setMsg("Informe o nome da modalidade.");

    setSalvandoEdit(true);

    const { error } = await supabase
      .from("modalidades")
      .update({ nome: n, tipo: editTipo })
      .eq("id", editId);

    setSalvandoEdit(false);

    if (error) {
      setMsg("Erro ao editar: " + error.message);
      return;
    }

    setMsg("Modalidade atualizada ✅");
    cancelarEdicao();
    carregar(true);
  }

  async function excluirModalidade(m: Modalidade) {
    const ok = window.confirm(
      `Excluir de verdade a modalidade "${m.nome}"?\n\nIsso NÃO pode ser desfeito.`
    );
    if (!ok) return;

    setMsg("");
    setExcluindoId(m.id);

    const { error } = await supabase.from("modalidades").delete().eq("id", m.id);

    setExcluindoId(null);

    if (error) {
      // dica útil quando tem FK impedindo
      setMsg(
        "Erro ao excluir: " +
          error.message +
          "\n\nSe ela estiver vinculada a algum evento (ex: evento_modalidades), o banco pode bloquear o DELETE."
      );
      return;
    }

    // remove da tela sem precisar recarregar
    setLista((prev) => prev.filter((x) => x.id !== m.id));
    setMsg("Modalidade excluída ✅");
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

        <button
          onClick={adicionar}
          disabled={salvandoNovo}
          style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
        >
          {salvandoNovo ? "Salvando..." : "Adicionar"}
        </button>

        {msg && <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>}
      </div>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>
        Lista {carregando ? "• Carregando..." : ""}
      </h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {lista.map((m) => {
          const editando = editId === m.id;

          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 230px",
                gap: 10,
                padding: 12,
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              {/* nome */}
              <div>
                {editando ? (
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                ) : (
                  <span>{m.nome}</span>
                )}
              </div>

              {/* tipo */}
              <div>
                {editando ? (
                  <select
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value as any)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  >
                    <option value="COLETIVA">COLETIVA</option>
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                  </select>
                ) : (
                  <span>{m.tipo}</span>
                )}
              </div>

              {/* ações */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {editando ? (
                  <>
                    <button
                      onClick={salvarEdicao}
                      disabled={salvandoEdit}
                      style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                    >
                      {salvandoEdit ? "Salvando..." : "Salvar"}
                    </button>

                    <button
                      onClick={cancelarEdicao}
                      style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => iniciarEdicao(m)}
                      style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => excluirModalidade(m)}
                      disabled={excluindoId === m.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #f5b5b5",
                        background: "#ffecec",
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

        {lista.length === 0 && (
          <div style={{ padding: 12 }}>Nenhuma modalidade cadastrada.</div>
        )}
      </div>
    </main>
  );
}