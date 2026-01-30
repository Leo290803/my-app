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

type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";

type AtletaRow = {
  id: number;
  nome: string;
  cpf: string | null;
  sexo: "M" | "F" | null;
  ativo: boolean | null;
  doc_status?: DocStatus | null;
};

type AtletaDetalhe = {
  id: number;
  nome: string;
  cpf: string | null;
  sexo: "M" | "F" | null;
  data_nascimento?: string | null;
  rg?: string | null;
  telefone?: string | null;
  email_contato?: string | null;
  ativo?: boolean | null;
};

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function IconLupa({ title }: { title?: string }) {
  return (
    <span
      title={title ?? "Ver"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      🔍
    </span>
  );
}

export default function EscolasPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const [municipioId, setMunicipioId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");

  // pesquisa escolas
  const [q, setQ] = useState("");

  // edição inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editMunicipioId, setEditMunicipioId] = useState<string>("");
  const [editAtivo, setEditAtivo] = useState(true);

  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  // ✅ MODAL: atletas da escola
  const [openEscolaId, setOpenEscolaId] = useState<number | null>(null);
  const [openEscolaNome, setOpenEscolaNome] = useState<string>("");

  const [qAtletaNome, setQAtletaNome] = useState("");
  const [qAtletaCpf, setQAtletaCpf] = useState("");

  const [carregandoAtletas, setCarregandoAtletas] = useState(false);
  const [atletasDaEscola, setAtletasDaEscola] = useState<AtletaRow[]>([]);

  // ✅ MODAL: dados do atleta
  const [openAtletaId, setOpenAtletaId] = useState<number | null>(null);
  const [carregandoAtleta, setCarregandoAtleta] = useState(false);
  const [atletaDetalhe, setAtletaDetalhe] = useState<AtletaDetalhe | null>(null);

  async function carregarMunicipios() {
    const { data, error } = await supabase.from("municipios").select("id, nome").order("nome");
    if (error) return setMsg("Erro ao carregar municípios: " + error.message);
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
        municipios ( nome )
      `
      )
      .order("nome");

    if (error) return setMsg("Erro ao carregar escolas: " + error.message);
    setEscolas((data ?? []) as any);
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

    const { data: perfis, error: pErr } = await supabase.from("perfis").select("user_id").eq("escola_id", e.id).limit(1);

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

    const { error } = await supabase.from("escolas").delete().eq("id", e.id);

    setExcluindoId(null);
    if (error) return setMsg("Erro ao excluir escola: " + error.message);

    setMsg("Escola excluída definitivamente ✅");
    carregarEscolas();
  }

  // ✅ junta doc_status vindo de participante_arquivos (opcional mas útil)
  async function anexarStatusDocs(atletasBase: any[], escolaId: number): Promise<AtletaRow[]> {
    const ids = atletasBase.map((a) => Number(a.id)).filter(Boolean);
    const statusById = new Map<number, DocStatus>();

    if (ids.length > 0) {
      const { data: arqs, error: aErr } = await supabase
        .from("participante_arquivos")
        .select("participante_id, status")
        .eq("escola_id", escolaId)
        .eq("participante_tipo", "ATLETA")
        .in("participante_id", ids);

      if (aErr) console.warn("Erro status docs:", aErr.message);

      (arqs ?? []).forEach((r: any) => {
        statusById.set(Number(r.participante_id), (r.status ?? "PENDENTE") as DocStatus);
      });
    }

    return atletasBase.map((a: any) => ({
      id: Number(a.id),
      nome: a.nome ?? "",
      cpf: a.cpf ?? null,
      sexo: a.sexo ?? null,
      ativo: a.ativo ?? true,
      doc_status: statusById.get(Number(a.id)) ?? ("PENDENTE" as DocStatus),
    })) as AtletaRow[];
  }

  // ✅ carrega atletas da escola (até 50), com filtro por nome/CPF
  async function carregarAtletasDaEscola(escolaId: number, nome: string, cpf: string) {
    setCarregandoAtletas(true);

    const nomeTrim = (nome ?? "").trim();
    const cpfLimpo = onlyDigits(cpf);

    let q = supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, ativo")
      .eq("escola_id", escolaId);

    // (se quiser mostrar só ativos, descomenta)
    // q = q.eq("ativo", true);

    if (nomeTrim) q = q.ilike("nome", `%${nomeTrim}%`);
    if (cpfLimpo) q = q.ilike("cpf", `%${cpfLimpo}%`);

    const { data, error } = await q.order("nome", { ascending: true }).limit(50);

    setCarregandoAtletas(false);

    if (error) {
      setAtletasDaEscola([]);
      return setMsg("Erro ao carregar atletas: " + error.message);
    }

    const merged = await anexarStatusDocs((data ?? []) as any[], escolaId);
    setAtletasDaEscola(merged);
  }

  // ✅ abrir modal da escola (ATLETAS CADASTRADOS)
  async function abrirAtletasDaEscola(e: Escola) {
    setMsg("");
    setOpenEscolaId(e.id);
    setOpenEscolaNome(e.nome);
    setQAtletaNome("");
    setQAtletaCpf("");
    setAtletasDaEscola([]);
    await carregarAtletasDaEscola(e.id, "", "");
  }

  function fecharModalEscola() {
    setOpenEscolaId(null);
    setOpenEscolaNome("");
    setQAtletaNome("");
    setQAtletaCpf("");
    setAtletasDaEscola([]);
  }

  // ✅ abrir modal atleta detalhe
  async function abrirAtleta(atletaId: number) {
    setOpenAtletaId(atletaId);
    setAtletaDetalhe(null);
    setCarregandoAtleta(true);

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, data_nascimento, rg, telefone, email_contato, ativo")
      .eq("id", atletaId)
      .maybeSingle();

    setCarregandoAtleta(false);

    if (error) {
      setAtletaDetalhe(null);
      return setMsg("Erro ao carregar atleta: " + error.message);
    }

    setAtletaDetalhe((data ?? null) as any);
  }

  function fecharModalAtleta() {
    setOpenAtletaId(null);
    setAtletaDetalhe(null);
  }

  // debounce do filtro de atletas no modal
  const debouncedAtletas = useMemo(
    () =>
      debounce((nome: string, cpf: string, escolaId: number) => {
        carregarAtletasDaEscola(escolaId, nome, cpf);
      }, 350),
    []
  );

  useEffect(() => {
    if (!openEscolaId) return;
    debouncedAtletas(qAtletaNome, qAtletaCpf, openEscolaId);
  }, [qAtletaNome, qAtletaCpf, openEscolaId, debouncedAtletas]);

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
            gridTemplateColumns: "1.4fr 1fr 110px 260px",
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
          <span style={{ textAlign: "right" }}>Ações</span>
        </div>

        {filtradas.map((e) => {
          const editando = editId === e.id;

          return (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 110px 260px",
                gap: 10,
                padding: 12,
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              {/* Escola */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {editando ? (
                  <input
                    value={editNome}
                    onChange={(ev) => setEditNome(ev.target.value)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                ) : (
                  <>
                    <span style={{ fontWeight: 650 }}>{e.nome}</span>

                    {/* ✅ LUPA DA ESCOLA -> ATLETAS CADASTRADOS */}
                    <span onClick={() => abrirAtletasDaEscola(e)}>
                      <IconLupa title="Ver atletas cadastrados desta escola" />
                    </span>
                  </>
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
                    <input type="checkbox" checked={editAtivo} onChange={(ev) => setEditAtivo(ev.target.checked)} />
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

      {/* ✅ MODAL: ATLETAS CADASTRADOS DA ESCOLA */}
      {openEscolaId && (
        <div
          onClick={fecharModalEscola}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1000px, 96vw)",
              maxHeight: "86vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eee",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Atletas cadastrados</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{openEscolaNome}</div>
              </div>

              <button
                onClick={fecharModalEscola}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Nome do atleta</div>
                  <input
                    value={qAtletaNome}
                    onChange={(e) => setQAtletaNome(e.target.value)}
                    placeholder="Digite para buscar..."
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>CPF</div>
                  <input
                    value={qAtletaCpf}
                    onChange={(e) => setQAtletaCpf(onlyDigits(e.target.value))}
                    placeholder="Somente números..."
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1.3fr 180px 120px 140px 140px",
                    gap: 10,
                    padding: 12,
                    fontWeight: 800,
                    background: "#fafafa",
                    borderBottom: "1px solid #eee",
                    alignItems: "center",
                  }}
                >
                  <span></span>
                  <span>Atleta</span>
                  <span>CPF</span>
                  <span>Sexo</span>
                  <span>Docs</span>
                  <span>Status</span>
                </div>

                {carregandoAtletas && <div style={{ padding: 12 }}>Carregando...</div>}

                {!carregandoAtletas &&
                  atletasDaEscola.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 1.3fr 180px 120px 140px 140px",
                        gap: 10,
                        padding: 12,
                        borderBottom: "1px solid #eee",
                        alignItems: "center",
                      }}
                    >
                      <span onClick={() => abrirAtleta(a.id)}>
                        <IconLupa title="Ver dados do atleta" />
                      </span>

                      <div style={{ fontWeight: 700 }}>{a.nome}</div>
                      <div>{a.cpf ?? "—"}</div>
                      <div>{a.sexo === "M" ? "Masc" : a.sexo === "F" ? "Fem" : "—"}</div>
                      <div>{a.doc_status ?? "PENDENTE"}</div>
                      <div>{a.ativo === false ? "Inativo" : "Ativo"}</div>
                    </div>
                  ))}

                {!carregandoAtletas && atletasDaEscola.length === 0 && <div style={{ padding: 12 }}>Nenhum atleta encontrado.</div>}
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Mostrando até <b>50</b> atletas por vez (ordem alfabética). Use a busca para encontrar rápido.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL: DADOS DO ATLETA */}
      {openAtletaId && (
        <div
          onClick={fecharModalAtleta}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 96vw)",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eee",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Dados do atleta</div>
              <button
                onClick={fecharModalAtleta}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
              >
                Fechar
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {carregandoAtleta && <div>Carregando...</div>}

              {!carregandoAtleta && !atletaDetalhe && <div>Não foi possível carregar os dados.</div>}

              {!carregandoAtleta && atletaDetalhe && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{atletaDetalhe.nome}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <b>CPF:</b> {atletaDetalhe.cpf ?? "—"}
                    </div>
                    <div>
                      <b>Sexo:</b> {atletaDetalhe.sexo ?? "—"}
                    </div>
                    <div>
                      <b>Nascimento:</b> {atletaDetalhe.data_nascimento ?? "—"}
                    </div>
                    <div>
                      <b>RG:</b> {atletaDetalhe.rg ?? "—"}
                    </div>
                    <div>
                      <b>Telefone:</b> {atletaDetalhe.telefone ?? "—"}
                    </div>
                    <div>
                      <b>Email:</b> {atletaDetalhe.email_contato ?? "—"}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    ID: {atletaDetalhe.id} • Status: {atletaDetalhe.ativo === false ? "Inativo" : "Ativo"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}