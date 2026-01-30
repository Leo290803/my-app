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

type Atleta = {
  id: number;
  nome: string;
  cpf?: string | null;
  sexo: "M" | "F";
  ativo: boolean;
  doc_status?: DocStatus | null;
};

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

  // busca atletas (não carrega todos)
  const [qNome, setQNome] = useState("");
  const [qCpf, setQCpf] = useState("");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [atletaSelId, setAtletaSelId] = useState<string>("");
  const [carregandoAtletas, setCarregandoAtletas] = useState(false);

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
    const { data, error } = await supabase
      .from("eventos")
      .select("id, nome, municipio_id, inscricoes_abertas")
      .order("id", { ascending: false });

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

  // carrega 10 atletas iniciais (ordem alfabética)
  async function carregarAtletasTop10() {
    if (!perfil?.escola_id) return;
    setCarregandoAtletas(true);

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(10);

    setCarregandoAtletas(false);

    if (error) return setMsg("Erro atletas: " + error.message);

    const atletasBase = (data ?? []) as any[];
    const merged = await anexarStatusDocs(atletasBase, perfil.escola_id);
    setAtletas(merged);
    setAtletaSelId(merged[0]?.id ? String(merged[0].id) : "");
  }

  // busca atletas por nome/CPF (até 50)
  async function buscarAtletas(nome: string, cpf: string) {
    if (!perfil?.escola_id) return;

    const nomeTrim = (nome ?? "").trim();
    const cpfLimpo = onlyDigits(cpf);

    if (!nomeTrim && !cpfLimpo) {
      await carregarAtletasTop10();
      return;
    }

    if (nomeTrim && nomeTrim.length < 2 && !cpfLimpo) return;

    setCarregandoAtletas(true);

    let q = supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true);

    if (nomeTrim) q = q.ilike("nome", `%${nomeTrim}%`);
    if (cpfLimpo) q = q.ilike("cpf", `%${cpfLimpo}%`);

    const { data, error } = await q.order("nome", { ascending: true }).limit(50);

    setCarregandoAtletas(false);

    if (error) return setMsg("Erro ao buscar atletas: " + error.message);

    const atletasBase = (data ?? []) as any[];
    const merged = await anexarStatusDocs(atletasBase, perfil.escola_id);

    setAtletas(merged);
    setAtletaSelId(merged[0]?.id ? String(merged[0].id) : "");
  }

  // junta doc_status vindo de participante_arquivos
  async function anexarStatusDocs(atletasBase: any[], escolaId: number): Promise<Atleta[]> {
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
      ...a,
      doc_status: statusById.get(Number(a.id)) ?? ("PENDENTE" as DocStatus),
    })) as Atleta[];
  }

  // -------- load inscrições --------
  // ✅ ALTERADO: só traz ATIVAS (assim CANCELADA some da lista)
  async function carregarInscricoesIndividuais(emIdNum: number) {
    setInscInd([]);
    if (!perfil?.escola_id) return;

    const { data, error } = await supabase
      .from("inscricoes_individuais")
      .select("id, atleta_id, status")
      .eq("evento_modalidade_id", emIdNum)
      .eq("status", "ATIVA"); // ✅ aqui

    if (error) return setMsg("Erro inscricoes_individuais: " + error.message);
    setInscInd((data ?? []) as any);
  }

  // ✅ ALTERADO: só traz ATIVAS (assim CANCELADA some da lista)
  async function carregarInscricoesProva(epIdNum: number) {
    setInscProva([]);
    if (!perfil?.escola_id) return;

    const { data, error } = await supabase
      .from("inscricoes_provas")
      .select("id, atleta_id, status")
      .eq("evento_prova_id", epIdNum)
      .eq("escola_id", perfil.escola_id)
      .eq("status", "ATIVA"); // ✅ aqui

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
  // ✅ ALTERADO: se já existir CANCELADA, reativa em vez de inserir outra linha
  async function inscreverSelecionado() {
    setMsg("");
    if (!exigirEventoAberto()) return;

    const atletaId = Number(atletaSelId);
    if (!atletaId) return setMsg("Selecione um atleta na lista.");
    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");

    const atleta = atletas.find((x) => x.id === atletaId);
    if (atleta && atleta.doc_status !== "CONCLUIDO") {
      return setMsg(`Atleta com documentos ${atleta.doc_status ?? "PENDENTE"}. Envie os docs e aguarde conferência.`);
    }

    const emIdNum = Number(emId);
    if (!emIdNum) return setMsg("Selecione categoria/naipe (evento_modalidade).");
    if (provasAtivas.length > 0 && !eventoProvaId) return setMsg("Selecione uma prova.");

    // ===== PROVA =====
    if (eventoProvaId) {
      const epIdNum = Number(eventoProvaId);
      const ep = provasAtivas.find((p) => p.id === epIdNum);
      if (!ep) return setMsg("Configuração da prova não encontrada.");

      const max = ep.max_por_escola ?? 0;
      if (max > 0 && vagasUsadas >= max) return setMsg("Limite de atletas atingido para esta prova.");

      // 1) se já existe ATIVA, impede
      const { data: jaAtiva, error: eAtiva } = await supabase
        .from("inscricoes_provas")
        .select("id")
        .eq("evento_prova_id", epIdNum)
        .eq("escola_id", perfil.escola_id)
        .eq("atleta_id", atletaId)
        .eq("status", "ATIVA")
        .maybeSingle();

      if (eAtiva) return setMsg("Erro ao verificar inscrição: " + eAtiva.message);
      if (jaAtiva?.id) return setMsg("Este atleta já está inscrito nesta prova.");

      // 2) se existe CANCELADA, reativa
      const { data: cancelada, error: eCanc } = await supabase
        .from("inscricoes_provas")
        .select("id")
        .eq("evento_prova_id", epIdNum)
        .eq("escola_id", perfil.escola_id)
        .eq("atleta_id", atletaId)
        .eq("status", "CANCELADA")
        .maybeSingle();

      if (eCanc) return setMsg("Erro ao verificar cancelada: " + eCanc.message);

      if (cancelada?.id) {
        const { error: upErr } = await supabase.from("inscricoes_provas").update({ status: "ATIVA" }).eq("id", cancelada.id);
        if (upErr) return setMsg("Erro ao reativar: " + upErr.message);

        setMsg("Inscrição reativada ✅");
        await carregarInscricoesProva(epIdNum);
        await carregarVagasUsadas(epIdNum);
        return;
      }

      // 3) senão, insere nova
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

    // ===== INDIVIDUAL =====
    // 1) se já existe ATIVA, impede
    const { data: jaAtivaInd, error: eAtivaInd } = await supabase
      .from("inscricoes_individuais")
      .select("id")
      .eq("evento_modalidade_id", emIdNum)
      .eq("atleta_id", atletaId)
      .eq("status", "ATIVA")
      .maybeSingle();

    if (eAtivaInd) return setMsg("Erro ao verificar inscrição: " + eAtivaInd.message);
    if (jaAtivaInd?.id) return setMsg("Este atleta já está inscrito nesta modalidade.");

    // 2) se existe CANCELADA, reativa
    const { data: canceladaInd, error: eCancInd } = await supabase
      .from("inscricoes_individuais")
      .select("id")
      .eq("evento_modalidade_id", emIdNum)
      .eq("atleta_id", atletaId)
      .eq("status", "CANCELADA")
      .maybeSingle();

    if (eCancInd) return setMsg("Erro ao verificar cancelada: " + eCancInd.message);

    if (canceladaInd?.id) {
      const { error: upErr } = await supabase.from("inscricoes_individuais").update({ status: "ATIVA" }).eq("id", canceladaInd.id);
      if (upErr) return setMsg("Erro ao reativar: " + upErr.message);

      setMsg("Inscrição reativada ✅");
      await carregarInscricoesIndividuais(emIdNum);
      return;
    }

    // 3) senão, insere nova
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

      // ✅ vai recarregar só as ATIVAS, então some da lista
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

    // ✅ vai recarregar só as ATIVAS, então some da lista
    const emIdNum = Number(emId);
    if (emIdNum) await carregarInscricoesIndividuais(emIdNum);
  }

  // -------- effects --------
  useEffect(() => {
    if (!perfil?.escola_id) return;
    carregarAtletasTop10();
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

  const debouncedBuscar = useMemo(
    () =>
      debounce((nome: string, cpf: string) => {
        buscarAtletas(nome, cpf);
      }, 350),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perfil?.escola_id]
  );

  useEffect(() => {
    debouncedBuscar(qNome, qCpf);
  }, [qNome, qCpf, debouncedBuscar]);

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
    if (eventoProvaId) return inscProva.length; // já vem só ATIVA
    return inscInd.length; // já vem só ATIVA
  }, [inscInd, inscProva, eventoProvaId]);

  const atletaSelecionado = useMemo(() => {
    const id = Number(atletaSelId);
    return atletas.find((a) => a.id === id) ?? null;
  }, [atletas, atletaSelId]);

  const podeInscrever =
    !!atletaSelId &&
    !!emId &&
    !bloqueado &&
    !(provasAtivas.length > 0 && !eventoProvaId) &&
    (atletaSelecionado?.doc_status ?? "PENDENTE") === "CONCLUIDO";

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontWeight: 900, fontSize: 22 }}>Inscrições</h2>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, background: "#fff7e6", border: "1px solid #ffe58f", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Config */}
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
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

        {/* Buscar atletas */}
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
          <div style={{ padding: 10, fontWeight: 800 }}>Buscar atletas disponíveis</div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Nome do atleta</div>
                <input
                  placeholder="Pesquise..."
                  value={qNome}
                  onChange={(e) => setQNome(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>CPF</div>
                <input
                  placeholder="Informe o CPF"
                  value={qCpf}
                  onChange={(e) => setQCpf(onlyDigits(e.target.value))}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
              </div>
            </div>

            <select
              size={10}
              value={atletaSelId}
              onChange={(e) => setAtletaSelId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              {carregandoAtletas && <option>Carregando...</option>}
              {!carregandoAtletas && atletas.length === 0 && <option>Nenhum atleta encontrado.</option>}
              {!carregandoAtletas &&
                atletas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} — {a.sexo === "M" ? "Masc" : "Fem"} — Docs: {a.doc_status ?? "PENDENTE"}
                  </option>
                ))}
            </select>

            <a
              onClick={(e) => {
                e.preventDefault();
                inscreverSelecionado();
              }}
              style={{
                display: "inline-block",
                textAlign: "center",
                padding: 10,
                borderRadius: 8,
                cursor: podeInscrever ? "pointer" : "not-allowed",
                opacity: podeInscrever ? 1 : 0.6,
                background: "#f3f4f6",
                userSelect: "none",
              }}
              title={
                bloqueado
                  ? "Inscrições encerradas"
                  : !emId
                  ? "Selecione categoria/naipe"
                  : provasAtivas.length > 0 && !eventoProvaId
                  ? "Selecione a prova"
                  : (atletaSelecionado?.doc_status ?? "PENDENTE") !== "CONCLUIDO"
                  ? "Docs pendentes/rejeitados"
                  : "Inscrever"
              }
            >
              Inscrever selecionado
            </a>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Mostrando <b>{Math.min(atletas.length, 50)}</b> resultados (top 10 por padrão).
            </div>
          </div>
        </div>

        {/* Inscritos */}
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
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
                      disabled={bloqueado}
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
                      disabled={bloqueado}
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