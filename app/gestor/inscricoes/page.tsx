"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = {
  escola_id: number;
  municipio_id: number;
  tipo?: string;
  ativo?: boolean;
};

type Evento = { id: number; nome: string; municipio_id: number | null; inscricoes_abertas?: boolean };

type Modalidade = { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" };

type EventoModalidade = {
  id: number;
  evento_id: number;
  modalidade_id: number;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
};

type Prova = { id: number; nome: string; modalidade_id: number };

type EventoProva = {
  id: number;
  evento_modalidade_id: number;
  prova_id: number;
  max_por_escola: number;
  min_por_escola: number;
  ativo: boolean;
  provas?: { nome: string } | null;
};

type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";

type Atleta = { id: number; nome: string; sexo: "M" | "F"; ativo: boolean; doc_status?: DocStatus | null };

type InscricaoIndividual = {
  id: number;
  atleta_id: number;
  status: string;
};

type InscricaoProva = {
  id: number;
  atleta_id: number;
  status: string;
};

export default function GestorInscricoesPage() {
  const [msg, setMsg] = useState("");

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>("");

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [eventoModalidades, setEventoModalidades] = useState<EventoModalidade[]>([]);
  const [emId, setEmId] = useState<string>("");

  const [provasAtivas, setProvasAtivas] = useState<EventoProva[]>([]);
  const [eventoProvaId, setEventoProvaId] = useState<string>("");

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [busca, setBusca] = useState("");

  const [inscInd, setInscInd] = useState<InscricaoIndividual[]>([]);
  const [inscProva, setInscProva] = useState<InscricaoProva[]>([]);

  const [vagasUsadas, setVagasUsadas] = useState<number>(0);

  // ---------- helpers ----------
  function exigirEventoAberto() {
    const ev = eventos.find((e) => e.id === Number(eventoId));
    if (!ev) return true;
    if (ev.inscricoes_abertas === false) {
      setMsg("Inscrições encerradas para este evento.");
      return false;
    }
    return true;
  }

  const bloqueado = useMemo(() => {
    const ev = eventos.find((e) => e.id === Number(eventoId));
    return ev?.inscricoes_abertas === false;
  }, [eventos, eventoId]);

  const atletasDisponiveis = useMemo(() => {
    const inscritosSet = new Set<number>();
    if (eventoProvaId) {
      inscProva.filter((i) => i.status === "ATIVA").forEach((i) => inscritosSet.add(i.atleta_id));
    } else {
      inscInd.filter((i) => i.status === "ATIVA").forEach((i) => inscritosSet.add(i.atleta_id));
    }

    return atletas
      .filter((a) => a.ativo)
      .filter((a) => !inscritosSet.has(a.id))
      .filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [atletas, inscInd, inscProva, eventoProvaId, busca]);

  // -------- load base --------
  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase.from("perfis").select("escola_id, municipio_id, tipo, ativo").maybeSingle();

      if (error) return setMsg("Erro perfil: " + error.message);
      if (!data?.escola_id) return setMsg("Perfil sem escola.");
      if (data?.ativo === false) return setMsg("Seu perfil está inativo.");

      setPerfil(data as any);
      await carregarEventos();
      await carregarModalidades();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarEventos() {
    const { data, error } = await supabase.from("eventos").select("id, nome, municipio_id, inscricoes_abertas").order("id", { ascending: false });

    if (error) return setMsg("Erro eventos: " + error.message);
    setEventos((data ?? []) as any);
  }

  async function carregarModalidades() {
    const { data, error } = await supabase.from("modalidades").select("id, nome, tipo").order("nome");

    if (error) return setMsg("Erro modalidades: " + error.message);
    setModalidades((data ?? []) as any);
  }

  async function carregarEventoModalidades(evId: number) {
    setEventoModalidades([]);
    setEmId("");
    setEventoProvaId("");
    setProvasAtivas([]);
    setInscInd([]);
    setInscProva([]);
    setVagasUsadas(0);

    const { data, error } = await supabase
      .from("evento_modalidades")
      .select("id, evento_id, modalidade_id, categoria, naipe")
      .eq("evento_id", evId)
      .order("id");

    if (error) return setMsg("Erro evento_modalidades: " + error.message);
    setEventoModalidades((data ?? []) as any);
  }

  async function carregarProvasAtivas(emIdNum: number) {
    setProvasAtivas([]);
    setEventoProvaId("");

    const { data, error } = await supabase
      .from("evento_provas")
      .select("id, evento_modalidade_id, prova_id, max_por_escola, min_por_escola, ativo, provas(nome)")
      .eq("evento_modalidade_id", emIdNum)
      .eq("ativo", true)
      .order("id");

    if (error) return setMsg("Erro evento_provas: " + error.message);
    setProvasAtivas((data ?? []) as any);
  }

  async function carregarAtletasDaEscola(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo, ativo")
      .eq("escola_id", escolaId)
      .order("nome");

    if (error) return setMsg("Erro atletas: " + error.message);

    const atletasBase = (data ?? []) as any[];
    const ids = atletasBase.map((a) => a.id);

    // status da documentação (participante_arquivos)
    let statusById = new Map<number, DocStatus>();
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

    const merged = atletasBase.map((a) => ({
      ...a,
      doc_status: statusById.get(Number(a.id)) ?? ("PENDENTE" as DocStatus),
    }));

    setAtletas(merged as any);
  }

  // -------- load inscrições --------
  async function carregarInscricoesIndividuais(emIdNum: number) {
    setInscInd([]);
    if (!perfil?.escola_id) return;

    const { data, error } = await supabase
      .from("inscricoes_individuais")
      .select("id, atleta_id, status")
      .eq("evento_modalidade_id", emIdNum);

    if (error) return setMsg("Erro inscricoes_individuais: " + error.message);

    const atletasDaEscola = new Set(atletas.map((a) => a.id));
    const filtradas = (data ?? []).filter((i: any) => atletasDaEscola.has(i.atleta_id));
    setInscInd(filtradas as any);
  }

  async function carregarInscricoesProva(epIdNum: number) {
    setInscProva([]);
    if (!perfil?.escola_id) return;

    const { data, error } = await supabase
      .from("inscricoes_provas")
      .select("id, atleta_id, status")
      .eq("evento_prova_id", epIdNum)
      .eq("escola_id", perfil.escola_id);

    if (error) return setMsg("Erro inscricoes_provas: " + error.message);
    setInscProva((data ?? []) as any);
  }

  async function carregarVagasUsadas(epIdNum: number) {
    if (!perfil?.escola_id) return;
    const { count, error } = await supabase
      .from("inscricoes_provas")
      .select("*", { count: "exact", head: true })
      .eq("evento_prova_id", epIdNum)
      .eq("escola_id", perfil.escola_id)
      .eq("status", "ATIVA");

    if (error) return setMsg("Erro vagas usadas: " + error.message);
    setVagasUsadas(count ?? 0);
  }

  // -------- actions --------
  async function inscrever(atletaId: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;

    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");

    const atleta = atletas.find((x) => x.id === atletaId);
    if (atleta && atleta.doc_status !== "CONCLUIDO") {
      return setMsg(
        `Atleta com documentos ${atleta.doc_status ?? "PENDENTE"}. Envie Foto/Identidade e aguarde a conferência para poder inscrever.`
      );
    }

    const emIdNum = Number(emId);
    if (!emIdNum) return setMsg("Selecione categoria/naipe (evento_modalidade).");

    if (provasAtivas.length > 0 && !eventoProvaId) return setMsg("Selecione uma prova.");

    if (eventoProvaId) {
      const epIdNum = Number(eventoProvaId);
      const ep = provasAtivas.find((p) => p.id === epIdNum);
      if (!ep) return setMsg("Configuração da prova não encontrada.");

      const max = ep.max_por_escola ?? 0;
      if (max > 0 && vagasUsadas >= max) return setMsg("Limite de atletas atingido para esta prova.");

      const { error } = await supabase.from("inscricoes_provas").insert({
        evento_prova_id: epIdNum,
        atleta_id: atletaId,
        escola_id: perfil.escola_id,
        status: "ATIVA",
      });

      if (error) return setMsg("Erro ao inscrever: " + error.message);

      setMsg("Inscrição realizada ✅");
      await carregarInscricoesProva(epIdNum);
      await carregarVagasUsadas(epIdNum);
      return;
    }

    const { error } = await supabase.from("inscricoes_individuais").insert({
      evento_modalidade_id: emIdNum,
      atleta_id: atletaId,
      status: "ATIVA",
    });

    if (error) return setMsg("Erro ao inscrever: " + error.message);

    setMsg("Inscrição realizada ✅");
    await carregarInscricoesIndividuais(emIdNum);
  }

  async function cancelarInscricao(id: number, tipo: "INDIVIDUAL" | "PROVA") {
    setMsg("");
    if (!exigirEventoAberto()) return;

    if (tipo === "PROVA") {
      const { error } = await supabase.from("inscricoes_provas").update({ status: "CANCELADA" }).eq("id", id);
      if (error) return setMsg("Erro ao cancelar: " + error.message);

      setMsg("Cancelado ✅");
      const epIdNum = Number(eventoProvaId);
      if (epIdNum) {
        await carregarInscricoesProva(epIdNum);
        await carregarVagasUsadas(epIdNum);
      }
      return;
    }

    const { error } = await supabase.from("inscricoes_individuais").update({ status: "CANCELADA" }).eq("id", id);
    if (error) return setMsg("Erro ao cancelar: " + error.message);

    setMsg("Cancelado ✅");
    const emIdNum = Number(emId);
    if (emIdNum) await carregarInscricoesIndividuais(emIdNum);
  }

  // -------- effects --------
  useEffect(() => {
    (async () => {
      setMsg("");
      if (!perfil?.escola_id) return;

      await carregarAtletasDaEscola(perfil.escola_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.escola_id]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const evId = Number(eventoId);
      if (!evId) return;
      await carregarEventoModalidades(evId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const emIdNum = Number(emId);
      if (!emIdNum) return;

      await carregarProvasAtivas(emIdNum);
      await carregarInscricoesIndividuais(emIdNum);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emId]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const epIdNum = Number(eventoProvaId);
      if (!epIdNum) return;
      await carregarInscricoesProva(epIdNum);
      await carregarVagasUsadas(epIdNum);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoProvaId]);

  // -------- ui helpers --------
  const emSelecionadas = useMemo(() => {
    const evId = Number(eventoId);
    if (!evId) return [];
    return eventoModalidades.filter((em) => em.evento_id === evId);
  }, [eventoModalidades, eventoId]);

  const emLabel = (em: EventoModalidade) => {
    const mod = modalidades.find((m) => m.id === em.modalidade_id);
    const tipo = mod?.tipo === "COLETIVA" ? "Coletiva" : "Individual";
    return `${mod?.nome ?? "Modalidade"} • ${tipo} • ${em.categoria} • ${em.naipe === "M" ? "Masc" : "Fem"}`;
  };

  const inscritosAtivos = useMemo(() => {
    if (eventoProvaId) return inscProva.filter((i) => i.status === "ATIVA").length;
    return inscInd.filter((i) => i.status === "ATIVA").length;
  }, [inscInd, inscProva, eventoProvaId]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontWeight: 900, fontSize: 22 }}>Inscrições</h2>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, background: "#fff7e6", border: "1px solid #ffe58f", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 800 }}>Configuração</div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Evento</div>
              <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} style={{ width: "100%", padding: 10 }}>
                <option value="">Selecione...</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nome} {ev.inscricoes_abertas === false ? "(Encerrado)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Categoria / Naipe</div>
              <select value={emId} onChange={(e) => setEmId(e.target.value)} style={{ width: "100%", padding: 10 }}>
                <option value="">Selecione...</option>
                {emSelecionadas.map((em) => (
                  <option key={em.id} value={em.id}>
                    {emLabel(em)}
                  </option>
                ))}
              </select>
            </div>

            {provasAtivas.length > 0 && (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Prova (opcional)</div>
                <select value={eventoProvaId} onChange={(e) => setEventoProvaId(e.target.value)} style={{ width: "100%", padding: 10 }}>
                  <option value="">Selecione...</option>
                  {provasAtivas.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.provas?.nome ?? `Prova ${ep.prova_id}`} • max {ep.max_por_escola}
                    </option>
                  ))}
                </select>

                {eventoProvaId && (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                    Vagas usadas: <b>{vagasUsadas}</b>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Inscritos ativos: <b>{inscritosAtivos}</b>
            </div>
          </div>
        </div>

        {/* Atletas */}
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 800 }}>Atletas (sua escola)</div>

          <div style={{ padding: 10 }}>
            <input
              placeholder="Buscar atleta..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ padding: 10, width: "100%" }}
            />
          </div>

          {atletasDisponiveis.slice(0, 80).map((a) => (
            <div
              key={a.id}
              style={{
                padding: 10,
                borderTop: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{a.nome}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{a.sexo === "M" ? "Masculino" : "Feminino"}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Docs: <b>{a.doc_status ?? "PENDENTE"}</b>
                </div>
              </div>
              <button
                onClick={() => inscrever(a.id)}
                style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                disabled={bloqueado || !emId || (provasAtivas.length > 0 && !eventoProvaId) || (a.doc_status ?? "PENDENTE") !== "CONCLUIDO"}
                title={
                  bloqueado
                    ? "Inscrições encerradas"
                    : !emId
                    ? "Selecione categoria/naipe"
                    : provasAtivas.length > 0 && !eventoProvaId
                    ? "Selecione a prova"
                    : (a.doc_status ?? "PENDENTE") !== "CONCLUIDO"
                    ? "Docs pendentes/rejeitados"
                    : "Inscrever"
                }
              >
                Inscrever
              </button>
            </div>
          ))}

          {atletasDisponiveis.length === 0 && <div style={{ padding: 12, opacity: 0.85 }}>Nenhum atleta disponível.</div>}
        </div>

        {/* Inscritos */}
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 800 }}>
            Inscritos (sua escola) {eventoProvaId ? "• por prova" : "• por modalidade"}
          </div>

          {eventoProvaId ? (
            <>
              {inscProva.length === 0 && <div style={{ padding: 12 }}>Nenhuma inscrição.</div>}
              {inscProva.map((i) => {
                const atleta = atletas.find((a) => a.id === i.atleta_id);
                return (
                  <div
                    key={i.id}
                    style={{
                      padding: 10,
                      borderTop: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{atleta?.nome ?? `Atleta #${i.atleta_id}`}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Status: <b>{i.status}</b>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelarInscricao(i.id, "PROVA")}
                      style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                      disabled={bloqueado || i.status !== "ATIVA"}
                      title={bloqueado ? "Inscrições encerradas" : i.status !== "ATIVA" ? "Não está ativa" : "Cancelar"}
                    >
                      Cancelar
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {inscInd.length === 0 && <div style={{ padding: 12 }}>Nenhuma inscrição.</div>}
              {inscInd.map((i) => {
                const atleta = atletas.find((a) => a.id === i.atleta_id);
                return (
                  <div
                    key={i.id}
                    style={{
                      padding: 10,
                      borderTop: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{atleta?.nome ?? `Atleta #${i.atleta_id}`}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Status: <b>{i.status}</b>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelarInscricao(i.id, "INDIVIDUAL")}
                      style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                      disabled={bloqueado || i.status !== "ATIVA"}
                      title={bloqueado ? "Inscrições encerradas" : i.status !== "ATIVA" ? "Não está ativa" : "Cancelar"}
                    >
                      Cancelar
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}