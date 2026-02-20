"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  // criar
  const [municipioId, setMunicipioId] = useState<string>("");
  const [nome, setNome] = useState("");

  // pesquisa
  const [q, setQ] = useState("");

  // edição inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editMunicipioId, setEditMunicipioId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"ABERTO" | "ENCERRADO">("ABERTO");
  const [editInscricoes, setEditInscricoes] = useState(true);

  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [duplicandoId, setDuplicandoId] = useState<number | null>(null);

  async function carregarMunicipios() {
    const { data, error } = await supabase.from("municipios").select("id, nome").order("nome");
    if (error) return setMsg("Erro municípios: " + error.message);
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

    if (error) return setMsg("Erro eventos: " + error.message);
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
    const { error } = await supabase.from("eventos").update({ inscricoes_abertas: abrir }).eq("id", eventoId);
    if (error) return setMsg("Erro ao atualizar: " + error.message);

    setMsg(abrir ? "Inscrições reabertas ✅" : "Inscrições fechadas ✅");
    carregarEventos();
  }

  async function toggleStatus(eventoId: number, status: "ABERTO" | "ENCERRADO") {
    setMsg("");
    const { error } = await supabase.from("eventos").update({ status }).eq("id", eventoId);
    if (error) return setMsg("Erro ao atualizar status: " + error.message);

    // se encerrar, fecha inscrições junto (opcional, mas faz sentido)
    if (status === "ENCERRADO") {
      await supabase.from("eventos").update({ inscricoes_abertas: false }).eq("id", eventoId);
    }

    setMsg(status === "ENCERRADO" ? "Evento encerrado ✅" : "Evento reaberto ✅");
    carregarEventos();
  }

  function iniciarEdicao(e: Evento) {
    setMsg("");
    setEditId(e.id);
    setEditNome(e.nome ?? "");
    setEditMunicipioId(String(e.municipio_id ?? ""));
    setEditStatus(e.status);
    setEditInscricoes(!!e.inscricoes_abertas);
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
    setEditMunicipioId("");
    setEditStatus("ABERTO");
    setEditInscricoes(true);
  }

  async function salvarEdicao() {
    if (!editId) return;

    const n = editNome.trim();
    const mid = Number(editMunicipioId);

    if (!n) return setMsg("Informe o nome.");
    if (!mid) return setMsg("Selecione o município.");

    setMsg("");
    setSalvandoEdit(true);

    const { error } = await supabase
      .from("eventos")
      .update({
        nome: n,
        municipio_id: mid,
        status: editStatus,
        inscricoes_abertas: editInscricoes,
      })
      .eq("id", editId);

    setSalvandoEdit(false);

    if (error) return setMsg("Erro ao salvar edição: " + error.message);

    setMsg("Evento atualizado ✅");
    cancelarEdicao();
    carregarEventos();
  }

  // excluir real: tenta remover configs e depois o evento.
  // se tiver outras FKs, vai acusar erro => aí você me manda o nome do constraint e a tabela que eu te dou o SQL CASCADE.
  async function excluirEvento(e: Evento) {
    const ok = window.confirm(
      `Excluir o evento "${e.nome}"?\n\nIsso tentará apagar também as configurações (evento_modalidades) do evento.`
    );
    if (!ok) return;

    setMsg("");
    setExcluindoId(e.id);

    // 1) apaga configs do evento (pra não travar)
    const { error: cfgErr } = await supabase.from("evento_modalidades").delete().eq("evento_id", e.id);
    if (cfgErr) {
      setExcluindoId(null);
      return setMsg("Erro ao remover configurações (evento_modalidades): " + cfgErr.message);
    }

    // 2) apaga evento
    const { error } = await supabase.from("eventos").delete().eq("id", e.id);

    setExcluindoId(null);

    if (error) return setMsg("Erro ao excluir evento: " + error.message);

    setMsg("Evento excluído ✅");
    setEventos((prev) => prev.filter((x) => x.id !== e.id));
  }

  // duplicar: cria evento novo e copia configs do evento_modalidades
  async function duplicarEvento(orig: Evento) {
    const ok = window.confirm(`Duplicar o evento "${orig.nome}"?\n\nVai criar um novo evento e copiar as configurações.`);
    if (!ok) return;

    setMsg("");
    setDuplicandoId(orig.id);

    // 1) cria evento novo
    const nomeNovo = `${orig.nome} (CÓPIA)`;
    const { data: novoEvento, error: insErr } = await supabase
      .from("eventos")
      .insert({
        nome: nomeNovo,
        municipio_id: orig.municipio_id,
        status: "ABERTO",
        inscricoes_abertas: false, // normalmente começa fechado
      })
      .select("id")
      .single();

    if (insErr || !novoEvento?.id) {
      setDuplicandoId(null);
      return setMsg("Erro ao criar evento duplicado: " + (insErr?.message ?? "sem id"));
    }

    const novoId = novoEvento.id as number;

    // 2) pega configs do evento antigo
    const { data: cfgs, error: getErr } = await supabase
      .from("evento_modalidades")
      .select(
        `
        modalidade_id,
        categoria,
        naipe,
        min_por_escola,
        max_por_escola,
        min_por_equipe,
        max_por_equipe,
        limite_substituicoes,
        ativo
      `
      )
      .eq("evento_id", orig.id);

    if (getErr) {
      setDuplicandoId(null);
      return setMsg("Evento criado, mas falhou ao copiar configs: " + getErr.message);
    }

    const rows = (cfgs ?? []) as any[];

    if (rows.length > 0) {
      const payload = rows.map((r) => ({
        evento_id: novoId,
        modalidade_id: r.modalidade_id,
        categoria: r.categoria,
        naipe: r.naipe,
        min_por_escola: r.min_por_escola,
        max_por_escola: r.max_por_escola,
        min_por_equipe: r.min_por_equipe,
        max_por_equipe: r.max_por_equipe,
        limite_substituicoes: r.limite_substituicoes,
        ativo: r.ativo,
      }));

      const { error: copyErr } = await supabase.from("evento_modalidades").insert(payload);
      if (copyErr) {
        setDuplicandoId(null);
        return setMsg("Evento criado, mas erro ao copiar configs: " + copyErr.message);
      }
    }

    setDuplicandoId(null);
    setMsg(`Evento duplicado ✅ Novo ID: ${novoId}`);
    carregarEventos();
  }

  useEffect(() => {
    carregarMunicipios();
    carregarEventos();
  }, []);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return eventos;
    return eventos.filter((e) => {
      const nome = (e.nome ?? "").toLowerCase();
      const mun = (e.municipios?.nome ?? "").toLowerCase();
      return nome.includes(termo) || mun.includes(termo) || String(e.id).includes(termo);
    });
  }, [q, eventos]);

  return (
    <main style={{ padding: 24, maxWidth: 1150 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Eventos</h1>

      {/* CRIAR */}
      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 720 }}>
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

      {/* PESQUISA */}
      <div style={{ marginTop: 10, maxWidth: 720 }}>
        <input
          placeholder="Pesquisar por nome, município ou ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        {/* Cabeçalho */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.6fr 0.8fr 0.8fr 1.2fr",
            gap: 10,
            padding: 12,
            fontWeight: 700,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>Evento</span>
          <span>Status</span>
          <span>Inscrições</span>
          <span>Config</span>
          <span>Ações</span>
        </div>

        {filtrados.map((e) => {
          const editando = editId === e.id;

          return (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.6fr 0.8fr 0.8fr 1.2fr",
                gap: 10,
                padding: 12,
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              {/* evento */}
              <div>
                {editando ? (
                  <>
                    <input
                      value={editNome}
                      onChange={(ev) => setEditNome(ev.target.value)}
                      style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <select
                        value={editMunicipioId}
                        onChange={(ev) => setEditMunicipioId(ev.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                      >
                        <option value="">Selecione município...</option>
                        {municipios.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700 }}>{e.nome}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Município: {e.municipios ? e.municipios.nome : "—"} • ID: {e.id}
                    </div>
                  </>
                )}
              </div>

              {/* status */}
              <div>
                {editando ? (
                  <select
                    value={editStatus}
                    onChange={(ev) => setEditStatus(ev.target.value as any)}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                  >
                    <option value="ABERTO">ABERTO</option>
                    <option value="ENCERRADO">ENCERRADO</option>
                  </select>
                ) : (
                  <span>{e.status}</span>
                )}
              </div>

              {/* inscrições */}
              <div>
                {editando ? (
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={editInscricoes}
                      onChange={(ev) => setEditInscricoes(ev.target.checked)}
                    />
                    <span>{editInscricoes ? "ABERTAS" : "FECHADAS"}</span>
                  </label>
                ) : (
                  <span style={{ fontWeight: 700 }}>{e.inscricoes_abertas ? "ABERTAS" : "FECHADAS"}</span>
                )}
              </div>

              {/* configurar */}
              <div>
                <Link href={`/admin/eventos/${e.id}/configurar`}>Configurar</Link>
              </div>

              {/* ações */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
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

                    {e.inscricoes_abertas ? (
                      <button
                        onClick={() => toggleInscricoes(e.id, false)}
                        style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Fechar inscrições
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleInscricoes(e.id, true)}
                        style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Reabrir inscrições
                      </button>
                    )}

                    {e.status === "ABERTO" ? (
                      <button
                        onClick={() => toggleStatus(e.id, "ENCERRADO")}
                        style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Encerrar
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleStatus(e.id, "ABERTO")}
                        style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Reabrir
                      </button>
                    )}

                    <button
                      onClick={() => duplicarEvento(e)}
                      disabled={duplicandoId === e.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid #ddd",
                        background: "#fff",
                        opacity: duplicandoId === e.id ? 0.6 : 1,
                      }}
                    >
                      {duplicandoId === e.id ? "Duplicando..." : "Duplicar"}
                    </button>

                    <button
                      onClick={() => excluirEvento(e)}
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
                      {excluindoId === e.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filtrados.length === 0 && <div style={{ padding: 12 }}>Nenhum evento encontrado.</div>}
      </div>
    </main>
  );
}