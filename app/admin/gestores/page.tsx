"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type EscolaItem = { id: number; nome: string };

type GestorRow = {
  user_id: string;
  nome: string | null;
  cpf: string | null;
  escola_id: number | null;
  ativo: boolean;
  data_nascimento: string | null;
  escolas?: { nome: string } | null;
};

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

export default function GestoresPage() {
  const [escolas, setEscolas] = useState<EscolaItem[]>([]);
  const [lista, setLista] = useState<GestorRow[]>([]);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");

  // edição inline
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editEscolaId, setEditEscolaId] = useState<string>("");
  const [editNascimento, setEditNascimento] = useState<string>(""); // yyyy-mm-dd
  const [editRg, setEditRg] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editEmailContato, setEditEmailContato] = useState("");
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const [desativandoId, setDesativandoId] = useState<string | null>(null);

  async function carregarEscolas() {
    const { data, error } = await supabase.from("escolas").select("id, nome").order("nome");
    if (error) return setMsg("Erro ao carregar escolas: " + error.message);
    setEscolas((data ?? []) as any);
  }

  async function carregarGestores() {
    setMsg("");
    const { data, error } = await supabase
      .from("perfis")
      .select(
        `
        user_id,
        nome,
        cpf,
        escola_id,
        ativo,
        data_nascimento,
        rg,
        telefone,
        email_contato,
        escolas (
          nome
        )
      `
      )
      .eq("tipo", "GESTOR")
      .order("nome");

    if (error) return setMsg("Erro ao carregar gestores: " + error.message);
    setLista((data ?? []) as any);
  }

  function iniciarEdicao(g: any) {
    setMsg("");
    setEditUserId(g.user_id);
    setEditNome(g.nome ?? "");
    setEditCpf(onlyDigits(g.cpf ?? ""));
    setEditEscolaId(g.escola_id ? String(g.escola_id) : "");
    setEditNascimento(g.data_nascimento ?? "");
    setEditRg(g.rg ?? "");
    setEditTelefone(g.telefone ?? "");
    setEditEmailContato(g.email_contato ?? "");
  }

  function cancelarEdicao() {
    setEditUserId(null);
    setEditNome("");
    setEditCpf("");
    setEditEscolaId("");
    setEditNascimento("");
    setEditRg("");
    setEditTelefone("");
    setEditEmailContato("");
  }

  async function salvarEdicao() {
    if (!editUserId) return;

    const nome = editNome.trim();
    const cpf = onlyDigits(editCpf);
    const escolaIdNum = Number(editEscolaId);

    if (!nome) return setMsg("Informe o nome.");
    if (!cpf || cpf.length !== 11) return setMsg("CPF inválido (11 dígitos).");
    if (!escolaIdNum) return setMsg("Selecione a escola.");
    if (!editNascimento) return setMsg("Informe a data de nascimento.");

    setSalvandoEdit(true);
    setMsg("");

    // pega municipio_id da escola pra manter coerência do perfil
    const { data: escolaRow, error: escolaErr } = await supabase
      .from("escolas")
      .select("municipio_id")
      .eq("id", escolaIdNum)
      .maybeSingle();

    if (escolaErr) {
      setSalvandoEdit(false);
      return setMsg("Erro ao buscar município da escola: " + escolaErr.message);
    }

    const { error } = await supabase
      .from("perfis")
      .update({
        nome,
        cpf,
        escola_id: escolaIdNum,
        municipio_id: escolaRow?.municipio_id ?? null,
        data_nascimento: editNascimento,
        rg: editRg.trim() || null,
        telefone: editTelefone.trim() || null,
        email_contato: editEmailContato.trim() || null,
      })
      .eq("user_id", editUserId)
      .eq("tipo", "GESTOR");

    setSalvandoEdit(false);

    if (error) return setMsg("Erro ao salvar edição: " + error.message);

    setMsg("Gestor atualizado ✅");
    cancelarEdicao();
    carregarGestores();
  }

  async function desativar(g: GestorRow) {
    const ok = window.confirm(
      `Desativar o gestor "${g.nome ?? "—"}"?\n\nEle não conseguirá acessar o sistema.`
    );
    if (!ok) return;

    setMsg("");
    setDesativandoId(g.user_id);

    const { error } = await supabase
      .from("perfis")
      .update({ ativo: false })
      .eq("user_id", g.user_id)
      .eq("tipo", "GESTOR");

    setDesativandoId(null);

    if (error) return setMsg("Erro ao desativar: " + error.message);

    setMsg("Gestor desativado ✅");
    carregarGestores();
  }

  useEffect(() => {
    carregarEscolas();
    carregarGestores();
  }, []);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return lista;

    const tDigits = onlyDigits(termo);

    return lista.filter((g) => {
      const nome = (g.nome ?? "").toLowerCase();
      const cpf = onlyDigits(g.cpf ?? "");
      const escola = (g.escolas?.nome ?? "").toLowerCase();
      return (
        nome.includes(termo) ||
        escola.includes(termo) ||
        (tDigits && cpf.includes(tDigits))
      );
    });
  }, [q, lista]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Gestores</h1>

        <Link
          href="/admin/gestores/novo"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#1d4ed8",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Cadastrar novo gestor
        </Link>
      </div>

      <div style={{ marginTop: 12, maxWidth: 620 }}>
        <input
          placeholder="Pesquisar por nome do gestor, CPF ou escola..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <h2 style={{ marginTop: 18, fontSize: 18, fontWeight: 700 }}>Lista</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 180px 120px 260px",
            gap: 10,
            padding: 12,
            fontWeight: 700,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>Gestor</span>
          <span>Escola</span>
          <span>CPF</span>
          <span>Status</span>
          <span style={{ textAlign: "right" }}>Ações</span>
        </div>

        {filtrados.map((g) => {
          const editando = editUserId === g.user_id;

          return (
            <div
              key={g.user_id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 180px 120px 260px",
                gap: 10,
                padding: 12,
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              {/* Nome */}
              <div>
                {editando ? (
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                ) : (
                  <span>{g.nome ?? "—"}</span>
                )}
              </div>

              {/* Escola */}
              <div>
                {editando ? (
                  <select
                    value={editEscolaId}
                    onChange={(e) => setEditEscolaId(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  >
                    <option value="">Selecione...</option>
                    {escolas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{g.escolas?.nome ?? "—"}</span>
                )}
              </div>

              {/* CPF */}
              <div>
                {editando ? (
                  <input
                    value={editCpf}
                    onChange={(e) => setEditCpf(onlyDigits(e.target.value))}
                    placeholder="11 dígitos"
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                ) : (
                  <span>{g.cpf ?? "—"}</span>
                )}
              </div>

              {/* Status */}
              <div>
                <span>{g.ativo ? "Ativo" : "Inativo"}</span>
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
                      onClick={() => iniciarEdicao(g)}
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
                      onClick={() => desativar(g)}
                      disabled={desativandoId === g.user_id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #fca5a5",
                        background: "#fee2e2",
                        color: "#991b1b",
                        opacity: desativandoId === g.user_id ? 0.6 : 1,
                      }}
                    >
                      {desativandoId === g.user_id ? "..." : "Desativar"}
                    </button>
                  </>
                )}
              </div>

              {/* campos extras só quando editando (em “linha abaixo”) */}
              {editando ? (
                <div style={{ gridColumn: "1 / -1", marginTop: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Nascimento *</div>
                      <input
                        type="date"
                        value={editNascimento}
                        onChange={(e) => setEditNascimento(e.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>RG</div>
                      <input
                        value={editRg}
                        onChange={(e) => setEditRg(e.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Telefone</div>
                      <input
                        value={editTelefone}
                        onChange={(e) => setEditTelefone(e.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email (contato)</div>
                      <input
                        value={editEmailContato}
                        onChange={(e) => setEditEmailContato(e.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    ⚠️ Regra da senha (quando cria): <b>anoNascimento + últimos 4 do CPF</b>. Ex.: 2001 + 1234 ={" "}
                    <b>20011234</b>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {filtrados.length === 0 && <div style={{ padding: 12 }}>Nenhum gestor encontrado.</div>}
      </div>
    </main>
  );
}