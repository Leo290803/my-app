"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number; municipio_id: number };

type Evento = { id: number; nome: string; status: "ABERTO" | "ENCERRADO" };

type EventoModalidade = {
  id: number; // evento_modalidades.id
  evento_id: number;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
  min_por_equipe: number | null;
  max_por_equipe: number | null;
  modalidades: { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" } | null;
};

type Atleta = { id: number; nome: string; sexo: "M" | "F"; data_nascimento: string; ativo: boolean };

type Equipe = {
  id: number;
  nome: string;
  status: "PENDENTE" | "CONCLUIDO" | "CANCELADO";
  evento_modalidade_id: number;
};

type Membro = { id: number; atleta_id: number };

function calcCategoria(dataNascimento: string) {
  const hoje = new Date();
  const dn = new Date(dataNascimento);
  let idade = hoje.getFullYear() - dn.getFullYear();
  const m = hoje.getMonth() - dn.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dn.getDate())) idade--;

  if (idade >= 12 && idade <= 14) return "12-14";
  if (idade >= 15 && idade <= 17) return "15-17";
  return "FORA";
}

export default function GestorEquipesPage() {
  const [msg, setMsg] = useState("");

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>("");

  const [opcoes, setOpcoes] = useState<EventoModalidade[]>([]);
  const [eventoModalidadeId, setEventoModalidadeId] = useState<string>("");

  const [atletas, setAtletas] = useState<Atleta[]>([]);

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeId] = useState<string>("");

  const [membros, setMembros] = useState<Membro[]>([]);

  async function carregarPerfil() {
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id")
      .maybeSingle();

    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id || !data?.municipio_id) return setMsg("Perfil sem escola/município.");
    setPerfil(data as Perfil);
  }

  async function carregarEventos(municipioId: number) {
    const { data, error } = await supabase
      .from("eventos")
      .select("id, nome, status")
      .eq("municipio_id", municipioId)
      .eq("status", "ABERTO")
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro eventos: " + error.message);
    setEventos((data ?? []) as unknown as Evento[]);
  }

  async function carregarOpcoes(eventoIdNum: number) {
    const { data, error } = await supabase
      .from("evento_modalidades")
      .select(
        `
        id,
        evento_id,
        categoria,
        naipe,
        min_por_equipe,
        max_por_equipe,
        modalidades ( id, nome, tipo )
      `
      )
      .eq("evento_id", eventoIdNum)
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro opções: " + error.message);

    const all = (data ?? []) as unknown as EventoModalidade[];
    setOpcoes(all.filter((x) => x.modalidades?.tipo === "COLETIVA"));
  }

  async function carregarAtletas(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo, data_nascimento, ativo")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("nome");

    if (error) return setMsg("Erro atletas: " + error.message);
    setAtletas((data ?? []) as unknown as Atleta[]);
  }

  async function carregarEquipes(eventoModalidadeIdNum: number) {
    if (!perfil) return;

    const { data, error } = await supabase
      .from("equipes")
      .select("id, nome, status, evento_modalidade_id")
      .eq("evento_modalidade_id", eventoModalidadeIdNum)
      .eq("escola_id", perfil.escola_id)
      .neq("status", "CANCELADO")
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro equipes: " + error.message);
    setEquipes((data ?? []) as unknown as Equipe[]);
  }

  async function carregarMembros(equipeIdNum: number) {
    const { data, error } = await supabase
      .from("equipe_membros")
      .select("id, atleta_id")
      .eq("equipe_id", equipeIdNum);

    if (error) return setMsg("Erro membros: " + error.message);
    setMembros((data ?? []) as unknown as Membro[]);
  }

  const opcaoSelecionada = useMemo(() => {
    const id = Number(eventoModalidadeId);
    return opcoes.find((o) => o.id === id) ?? null;
  }, [eventoModalidadeId, opcoes]);

  const membrosSet = useMemo(() => new Set(membros.map((m) => m.atleta_id)), [membros]);

  const atletasElegiveis = useMemo(() => {
    if (!opcaoSelecionada) return [];
    return atletas.filter((a) => {
      const cat = calcCategoria(a.data_nascimento);
      return cat === opcaoSelecionada.categoria && a.sexo === opcaoSelecionada.naipe;
    });
  }, [atletas, opcaoSelecionada]);

  const minEquipe = opcaoSelecionada?.min_por_equipe ?? 0;
  const maxEquipe = opcaoSelecionada?.max_por_equipe ?? 999999;

  async function criarEquipe() {
    setMsg("");
    if (!perfil || !opcaoSelecionada) return setMsg("Selecione a modalidade coletiva.");

    const nomeEquipe = `${opcaoSelecionada.modalidades?.nome} ${opcaoSelecionada.naipe} ${opcaoSelecionada.categoria}`;

    const { data, error } = await supabase
      .from("equipes")
      .insert({
        evento_modalidade_id: opcaoSelecionada.id,
        escola_id: perfil.escola_id,
        municipio_id: perfil.municipio_id,
        nome: nomeEquipe,
        status: "PENDENTE",
      })
      .select("id")
      .maybeSingle();

    if (error) return setMsg("Erro ao criar equipe: " + error.message);

    setMsg("Equipe criada ✅");
    await carregarEquipes(opcaoSelecionada.id);
    if (data?.id) {
      setEquipeId(String(data.id));
      await carregarMembros(data.id);
    }
  }

  async function adicionarMembro(atleta: Atleta) {
    setMsg("");
    const eqid = Number(equipeId);
    if (!eqid) return setMsg("Selecione uma equipe.");

    if (membrosSet.has(atleta.id)) return setMsg("Esse atleta já está na equipe.");

    if (membros.length >= maxEquipe) return setMsg(`Equipe cheia. Máx: ${maxEquipe}`);

    const { error } = await supabase.from("equipe_membros").insert({
      equipe_id: eqid,
      atleta_id: atleta.id,
    });

    if (error) return setMsg("Erro ao adicionar: " + error.message);

    setMsg("Atleta adicionado ✅");
    carregarMembros(eqid);
  }

  async function removerMembro(atletaId: number) {
    setMsg("");
    const eqid = Number(equipeId);
    if (!eqid) return;

    const { error } = await supabase
      .from("equipe_membros")
      .delete()
      .eq("equipe_id", eqid)
      .eq("atleta_id", atletaId);

    if (error) return setMsg("Erro ao remover: " + error.message);

    setMsg("Atleta removido ✅");
    carregarMembros(eqid);
  }

  async function concluirEquipe() {
    setMsg("");
    const eqid = Number(equipeId);
    if (!eqid) return setMsg("Selecione uma equipe.");

    if (membros.length < minEquipe) {
      return setMsg(`Mínimo de atletas não atingido. Min: ${minEquipe}`);
    }
    if (membros.length > maxEquipe) {
      return setMsg(`Máximo excedido. Máx: ${maxEquipe}`);
    }

    const { error } = await supabase.from("equipes").update({ status: "CONCLUIDO" }).eq("id", eqid);
    if (error) return setMsg("Erro ao concluir: " + error.message);

    setMsg("Equipe concluída ✅");
    const emid = Number(eventoModalidadeId);
    if (emid) carregarEquipes(emid);
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    carregarEventos(perfil.municipio_id);
    carregarAtletas(perfil.escola_id);
  }, [perfil]);

  useEffect(() => {
    const eid = Number(eventoId);
    setEventoModalidadeId("");
    setEquipeId("");
    setOpcoes([]);
    setEquipes([]);
    setMembros([]);

    if (!eid || !Number.isFinite(eid)) return;
    carregarOpcoes(eid);
  }, [eventoId]);

  useEffect(() => {
    const emid = Number(eventoModalidadeId);
    setEquipeId("");
    setEquipes([]);
    setMembros([]);

    if (!emid || !Number.isFinite(emid)) return;
    carregarEquipes(emid);
  }, [eventoModalidadeId]);

  useEffect(() => {
    const eqid = Number(equipeId);
    setMembros([]);
    if (!eqid || !Number.isFinite(eqid)) return;
    carregarMembros(eqid);
  }, [equipeId]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestor • Equipes (Coletivas)</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 800 }}>
        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="">Selecione o evento...</option>
          {eventos.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.nome}
            </option>
          ))}
        </select>

        <select
          value={eventoModalidadeId}
          onChange={(e) => setEventoModalidadeId(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          disabled={!eventoId}
        >
          <option value="">Selecione a modalidade (coletiva)...</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.modalidades?.nome} • {o.categoria} • {o.naipe} • Equipe: {o.min_por_equipe ?? "—"}–{o.max_por_equipe ?? "—"}
            </option>
          ))}
        </select>

        {opcaoSelecionada && (
          <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ fontWeight: 700 }}>
              {opcaoSelecionada.modalidades?.nome} • {opcaoSelecionada.categoria} • {opcaoSelecionada.naipe}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Tamanho permitido: {minEquipe} até {maxEquipe === 999999 ? "∞" : maxEquipe}
            </div>
          </div>
        )}

        <button
          onClick={criarEquipe}
          disabled={!opcaoSelecionada}
          style={{ padding: 10, borderRadius: 8, cursor: "pointer", maxWidth: 240 }}
        >
          Criar equipe
        </button>

        <select
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          disabled={equipes.length === 0}
        >
          <option value="">Selecione a equipe...</option>
          {equipes.map((eq) => (
            <option key={eq.id} value={eq.id}>
              #{eq.id} • {eq.nome} • {eq.status}
            </option>
          ))}
        </select>

        {equipeId && (
          <button
            onClick={concluirEquipe}
            style={{ padding: 10, borderRadius: 8, cursor: "pointer", maxWidth: 240 }}
          >
            Concluir equipe
          </button>
        )}

        {msg && <p>{msg}</p>}
      </div>

      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 12, fontWeight: 700 }}>Membros da equipe</div>
          <div style={{ borderTop: "1px solid #eee" }}>
            {!equipeId && <div style={{ padding: 12 }}>Selecione/crie uma equipe.</div>}

            {equipeId &&
              membros.map((m) => {
                const atleta = atletas.find((a) => a.id === m.atleta_id);
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{atleta?.nome ?? `Atleta #${m.atleta_id}`}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {atleta ? `${atleta.sexo} • ${calcCategoria(atleta.data_nascimento)}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => removerMembro(m.atleta_id)}
                      style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
                    >
                      Remover
                    </button>
                  </div>
                );
              })}

            {equipeId && (
              <div style={{ padding: 12, fontSize: 13, opacity: 0.9 }}>
                Total: {membros.length} / {maxEquipe === 999999 ? "∞" : maxEquipe}
              </div>
            )}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 12, fontWeight: 700 }}>Atletas elegíveis</div>
          <div style={{ borderTop: "1px solid #eee" }}>
            {!opcaoSelecionada && <div style={{ padding: 12 }}>Selecione o evento e a modalidade coletiva.</div>}

            {opcaoSelecionada &&
              atletasElegiveis.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.nome}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {a.sexo} • {calcCategoria(a.data_nascimento)}
                    </div>
                  </div>

                  <button
                    onClick={() => adicionarMembro(a)}
                    disabled={!equipeId || membrosSet.has(a.id) || membros.length >= maxEquipe}
                    style={{ padding: 8, borderRadius: 8, cursor: "pointer" }}
                  >
                    Adicionar
                  </button>
                </div>
              ))}

            {opcaoSelecionada && atletasElegiveis.length === 0 && (
              <div style={{ padding: 12 }}>Nenhum atleta elegível.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
