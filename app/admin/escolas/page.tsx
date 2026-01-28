"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Municipio = { id: number; nome: string };

type Escola = {
  id: number;
  nome: string;
  ativo: boolean;
  municipio_id: number;
  municipios?: { nome: string };
};

export default function EscolasPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [municipioId, setMunicipioId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");

  // pesquisa
  const [q, setQ] = useState("");

  // edição inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editMunicipioId, setEditMunicipioId] = useState<string>("");
  const [editAtivo, setEditAtivo] = useState(true);

  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  async function carregarMunicipios() {
    const { data, error } = await supabase.from("municipios").select("id, nome").order("nome");

    if (error) {
      setMsg("Erro ao carregar municípios: " + error.message);
      return;
    }
    setMunicipios(data ?? []);
  }

  async function carregarEscolas() {
    const { data, error } = await supabase
      .from("escolas")
      .select(
        `
        id,
        nome,
        ativo,
        municipio_id,
        municipios (
          nome
        )
      `
      )
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar escolas: " + error.message);
      return;
    }

    setEscolas((data ?? []) as unknown as Escola[]);
  }

  async function adicionar() {
    setMsg("");

    const mid = Number(municipioId);
    if (!mid) return setMsg("Selecione um município.");
    if (!nome.trim()) return setMsg("Informe o nome da escola.");

    const { error } = await supabase.from("escolas").insert({
      municipio_id: mid,
      nome: nome.trim(),
      ativo: true,
    });

    if (error) return setMsg("Erro ao salvar: " + error.message);

    setNome("");
    setMunicipioId("");
    setMsg("Escola cadastrada ✅");
    carregarEscolas();
  }

  function iniciarEdicao(e: Escola) {
    setMsg("");
    setEditId(e.id);
    setEditNome(e.nome ?? "");
    setEditMunicipioId(String(e.municipio_id ?? ""));
    setEditAtivo(!!e.ativo);
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
    setEditMunicipioId("");
    setEditAtivo(true);
  }

  async function salvarEdicao() {
    if (!editId) return;

    const n = editNome.trim();
    if (!n) return setMsg("Informe o nome da escola.");

    const mid = Number(editMunicipioId);
    if (!mid) return setMsg("Selecione um município.");

    setSalvandoEdit(true);
    setMsg("");

    const { error } = await supabase
      .from("escolas")
      .update({
        nome: n,
        municipio_id: mid,
        ativo: editAtivo,
      })
      .eq("id", editId);

    setSalvandoEdit(false);

    if (error) return setMsg("Erro ao salvar edição: " + error.message);

    setMsg("Escola atualizada ✅");
    cancelarEdicao();
    carregarEscolas();
  }

  // ✅ Regra A: se tiver vínculo em perfis -> desativa; se não -> delete
  async function excluirEscola(e: Escola) {
    const ok = window.confirm(
      `Deseja excluir a escola "${e.nome}"?\n\nSe houver vínculos, ela será apenas DESATIVADA.\nSe não houver, será EXCLUÍDA de verdade.`
    );
    if (!ok) return;

    setMsg("");
    setExcluindoId(e.id);

    // perfis NÃO tem id. Tem user_id. Então checa por user_id.
    const { data: perfis, error: pErr } = await supabase
      .from("perfis")
      .select("user_id")
      .eq("escola_id", e.id)
      .limit(1);

    if (pErr) {
      setExcluindoId(null);
      return setMsg("Erro ao verificar vínculos (perfis): " + pErr.message);
    }

    const temVinculo = !!(perfis && perfis.length > 0);

    if (temVinculo) {
      const { error } = await supabase.from("escolas").update({ ativo: false }).eq("id", e.id);

      setExcluindoId(null);

      if (error) return setMsg("Erro ao desativar escola: " + error.message);

      setMsg("Escola desativada (possui vínculos) ⚠️");
      carregarEscolas();
      return;
    }

    // sem vínculo -> delete real
    const { error } = await supabase.from("escolas").delete().eq("id", e.id);

    setExcluindoId(null);

    if (error) return setMsg("Erro ao excluir escola: " + error.message);

    setMsg("Escola excluída definitivamente ✅");
    carregarEscolas();
  }

  useEffect(() => {
    carregarMunicipios();
    carregarEscolas();
  }, []);

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return escolas;

    return escolas.filter((e) => {
      const nome = (e.nome ?? "").toLowerCase();
      const mun = (e.municipios?.nome ?? "").toLowerCase();
      return nome.includes(termo) || mun.includes(termo);
    });
  }, [q, escolas]);

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Escolas</h1>

      <div style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 620 }}>
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

        <button onClick={adicionar} style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}>
          Adicionar
        </button>

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 26, fontSize: 18, fontWeight: 700 }}>Lista</h2>

      {/* Pesquisa */}
      <div style={{ marginTop: 10, maxWidth: 620 }}>
        <input
          placeholder="Pesquisar por escola ou município..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        {/* Cabeçalho */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 110px 220px",
            gap: 10,
            padding: 12,
            fontWeight: 700,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>Escola</span>
          <span>Município</span>
          <span>Status</span>
          <span>Ações</span>
        </div>

        {filtradas.map((e) => {
          const editando = editId === e.id;

          return (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 110px 220px",
                gap: 10,
                padding: 12,
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              {/* Escola */}
              <div>
                {editando ? (
                  <input
                    value={editNome}
                    onChange={(ev) => setEditNome(ev.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                ) : (
                  <span>{e.nome}</span>
                )}
              </div>

              {/* Município */}
              <div>
                {editando ? (
                  <select
                    value={editMunicipioId}
                    onChange={(ev) => setEditMunicipioId(ev.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  >
                    <option value="">Selecione...</option>
                    {municipios.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{e.municipios?.nome ?? "—"}</span>
                )}
              </div>

              {/* Ativo */}
              <div>
                {editando ? (
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={editAtivo}
                      onChange={(ev) => setEditAtivo(ev.target.checked)}
                    />
                    <span>{editAtivo ? "Ativo" : "Inativo"}</span>
                  </label>
                ) : (
                  <span>{e.ativo ? "Ativo" : "Inativo"}</span>
                )}
              </div>

              {/* Ações */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {editando ? (
                  <>
                    <button
                      onClick={salvarEdicao}
                      disabled={salvandoEdit}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #93c5fd",
                        background: "#dbeafe",
                      }}
                    >
                      {salvandoEdit ? "Salvando..." : "Salvar"}
                    </button>

                    <button
                      onClick={cancelarEdicao}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => iniciarEdicao(e)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => excluirEscola(e)}
                      disabled={excluindoId === e.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #fca5a5",
                        background: "#fee2e2",
                        color: "#991b1b",
                        opacity: excluindoId === e.id ? 0.6 : 1,
                      }}
                    >
                      {excluindoId === e.id ? "..." : "Excluir"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filtradas.length === 0 && <div style={{ padding: 12 }}>Nenhuma escola cadastrada.</div>}
      </div>
    </main>
  );
}