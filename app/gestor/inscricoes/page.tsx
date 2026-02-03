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

type EventoModalidade = {
  id: number;
  evento_id: number;
  modalidade_id: number;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
  min_por_equipe?: number | null;
  max_por_equipe?: number | null;
  modalidades?: { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" } | null;
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
  data_nascimento?: string;
  ativo: boolean;
  doc_status?: DocStatus | null;
};

type InscricaoIndividual = { id: number; atleta_id: number; status: string };
type InscricaoProva = { id: number; atleta_id: number; status: string };

type Equipe = {
  id: number;
  nome: string;
  status: "PENDENTE" | "CONCLUIDO" | "CANCELADO";
  evento_modalidade_id: number;
};

type Membro = { id: number; atleta_id: number };

// =================== NOVO: Comissão Técnica (por evento) ===================
type Tecnico = {
  id: number;
  escola_id: number;
  nome: string;
  cpf?: string | null;
  funcao?: string | null; // ex: Técnico, Auxiliar, Chefe de Delegação, etc
  ativo?: boolean;
};

type EventoTecnico = {
  id: number;
  evento_id: number;
  comissao_id: number;
  escola_id: number;
  status?: string | null; // ATIVO/CANCELADO (opcional)
  comissao_tecnica?: { id: number; nome: string; cpf?: string | null; funcao?: string | null } | null;
};
// ==========================================================================

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

function calcCategoria(dataNascimento?: string) {
  if (!dataNascimento) return "FORA";
  const hoje = new Date();
  const dn = new Date(dataNascimento);
  let idade = hoje.getFullYear() - dn.getFullYear();
  const m = hoje.getMonth() - dn.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dn.getDate())) idade--;

  if (idade >= 12 && idade <= 14) return "12-14";
  if (idade >= 15 && idade <= 17) return "15-17";
  return "FORA";
}

export default function GestorInscricoesUnificadoPage() {
  const [msg, setMsg] = useState("");

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>("");

  const [eventoModalidades, setEventoModalidades] = useState<EventoModalidade[]>([]);

  // ---------- INDIVIDUAL ----------
  const [emIdInd, setEmIdInd] = useState<string>("");
  const [provasAtivas, setProvasAtivas] = useState<EventoProva[]>([]);
  const [eventoProvaId, setEventoProvaId] = useState<string>("");

  const [inscInd, setInscInd] = useState<InscricaoIndividual[]>([]);
  const [inscProva, setInscProva] = useState<InscricaoProva[]>([]);
  const [vagasUsadas, setVagasUsadas] = useState<number>(0);

  const [qNome, setQNome] = useState("");
  const [qCpf, setQCpf] = useState("");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [atletaSelId, setAtletaSelId] = useState<string>("");
  const [carregandoAtletas, setCarregandoAtletas] = useState(false);

  // ---------- COLETIVA ----------
  const [emIdCol, setEmIdCol] = useState<string>("");
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeId] = useState<string>("");
  const [membros, setMembros] = useState<Membro[]>([]);

  // ✅ COLETIVA: busca igual individual
  const [qNomeCol, setQNomeCol] = useState("");
  const [qCpfCol, setQCpfCol] = useState("");
  const [atletasCol, setAtletasCol] = useState<Atleta[]>([]);
  const [atletaSelColId, setAtletaSelColId] = useState<string>("");
  const [carregandoCol, setCarregandoCol] = useState(false);

  // =================== NOVO: Comissão Técnica ===================
  const [qTecNome, setQTecNome] = useState("");
  const [qTecCpf, setQTecCpf] = useState("");
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [tecnicoSelId, setTecnicoSelId] = useState<string>("");
  const [carregandoTec, setCarregandoTec] = useState(false);

  const [tecnicosEvento, setTecnicosEvento] = useState<EventoTecnico[]>([]);
  // =============================================================

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

  const emLabel = (em: EventoModalidade) => {
    const nome = em.modalidades?.nome ?? `Modalidade #${em.modalidade_id}`;
    const tipo = em.modalidades?.tipo === "COLETIVA" ? "Coletiva" : "Individual";
    return `${nome} • ${tipo} • ${em.categoria} • ${em.naipe === "M" ? "Masc" : "Fem"}`;
  };

  // ---------- load base ----------
  useEffect(() => {
    (async () => {
      setMsg("");

      const { data, error } = await supabase
        .from("perfis")
        .select("escola_id, municipio_id, tipo, ativo")
        .maybeSingle();

      if (error) return setMsg("Erro perfil: " + error.message);
      if (!data?.escola_id) return setMsg("Perfil sem escola.");
      if (data?.ativo === false) return setMsg("Seu perfil está inativo.");

      setPerfil(data as any);
      await carregarEventos();
    })();
  }, []);

  async function carregarEventos() {
    const { data, error } = await supabase
      .from("eventos")
      .select("id, nome, municipio_id, inscricoes_abertas")
      .order("id", { ascending: false });

    if (error) return setMsg("Erro eventos: " + error.message);
    setEventos((data ?? []) as any);
  }

  async function carregarEventoModalidades(evId: number) {
    setEventoModalidades([]);

    // reseta IND
    setEmIdInd("");
    setProvasAtivas([]);
    setEventoProvaId("");
    setInscInd([]);
    setInscProva([]);
    setVagasUsadas(0);

    // reseta COL
    setEmIdCol("");
    setEquipes([]);
    setEquipeId("");
    setMembros([]);
    setQNomeCol("");
    setQCpfCol("");
    setAtletasCol([]);
    setAtletaSelColId("");

    const { data, error } = await supabase
      .from("evento_modalidades")
      .select(
        `
        id, evento_id, modalidade_id, categoria, naipe, min_por_equipe, max_por_equipe,
        modalidades ( id, nome, tipo )
      `
      )
      .eq("evento_id", evId)
      .order("id");

    if (error) return setMsg("Erro evento_modalidades: " + error.message);
    setEventoModalidades((data ?? []) as any);
  }

  // ---------- atletas (docs) ----------
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

  // ---------- IND: top10 + busca ----------
  async function carregarAtletasTop10() {
    if (!perfil?.escola_id) return;
    setCarregandoAtletas(true);

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, data_nascimento, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(10);

    setCarregandoAtletas(false);
    if (error) return setMsg("Erro atletas: " + error.message);

    const merged = await anexarStatusDocs((data ?? []) as any[], perfil.escola_id);
    setAtletas(merged);
    setAtletaSelId(merged[0]?.id ? String(merged[0].id) : "");
  }

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
      .select("id, nome, cpf, sexo, data_nascimento, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true);

    if (nomeTrim) q = q.ilike("nome", `%${nomeTrim}%`);
    if (cpfLimpo) q = q.ilike("cpf", `%${cpfLimpo}%`);

    const { data, error } = await q.order("nome", { ascending: true }).limit(50);

    setCarregandoAtletas(false);
    if (error) return setMsg("Erro ao buscar atletas: " + error.message);

    const merged = await anexarStatusDocs((data ?? []) as any[], perfil.escola_id);
    setAtletas(merged);
    setAtletaSelId(merged[0]?.id ? String(merged[0].id) : "");
  }

  const debouncedBuscar = useMemo(
    () =>
      debounce((nome: string, cpf: string) => {
        buscarAtletas(nome, cpf);
      }, 350),
    [perfil?.escola_id]
  );

  useEffect(() => {
    if (!perfil?.escola_id) return;
    carregarAtletasTop10();
  }, [perfil?.escola_id]);

  useEffect(() => {
    debouncedBuscar(qNome, qCpf);
  }, [qNome, qCpf, debouncedBuscar]);

  // ---------- COLETIVA: top10 + busca (igual individual) ----------
  const opcaoColetivaSelecionada = useMemo(() => {
    const id = Number(emIdCol);
    return eventoModalidades.find((o) => o.id === id) ?? null;
  }, [emIdCol, eventoModalidades]);

  function filtrarElegiveisColetiva(lista: Atleta[]) {
    if (!opcaoColetivaSelecionada) return [];
    return lista.filter((a) => {
      const cat = calcCategoria(a.data_nascimento);
      const okCat = cat === opcaoColetivaSelecionada.categoria;
      const okSexo = a.sexo === opcaoColetivaSelecionada.naipe;
      const okDocs = (a.doc_status ?? "PENDENTE") === "CONCLUIDO";
      return okCat && okSexo && okDocs;
    });
  }

  async function carregarAtletasTop10Col() {
    if (!perfil?.escola_id) return;
    setCarregandoCol(true);

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, data_nascimento, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(50);

    setCarregandoCol(false);
    if (error) return setMsg("Erro atletas (coletiva): " + error.message);

    const merged = await anexarStatusDocs((data ?? []) as any[], perfil.escola_id);
    const elegiveis = filtrarElegiveisColetiva(merged);
    const top10 = elegiveis.slice(0, 10);

    setAtletasCol(top10);
    setAtletaSelColId(top10[0]?.id ? String(top10[0].id) : "");
  }

  async function buscarAtletasCol(nome: string, cpf: string) {
    if (!perfil?.escola_id) return;

    const nomeTrim = (nome ?? "").trim();
    const cpfLimpo = onlyDigits(cpf);

    if (!nomeTrim && !cpfLimpo) {
      await carregarAtletasTop10Col();
      return;
    }
    if (nomeTrim && nomeTrim.length < 2 && !cpfLimpo) return;

    setCarregandoCol(true);

    let q = supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, data_nascimento, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true);

    if (nomeTrim) q = q.ilike("nome", `%${nomeTrim}%`);
    if (cpfLimpo) q = q.ilike("cpf", `%${cpfLimpo}%`);

    const { data, error } = await q.order("nome", { ascending: true }).limit(50);

    setCarregandoCol(false);
    if (error) return setMsg("Erro ao buscar atletas (coletiva): " + error.message);

    const merged = await anexarStatusDocs((data ?? []) as any[], perfil.escola_id);
    const elegiveis = filtrarElegiveisColetiva(merged);

    setAtletasCol(elegiveis);
    setAtletaSelColId(elegiveis[0]?.id ? String(elegiveis[0].id) : "");
  }

  const debouncedBuscarCol = useMemo(
    () =>
      debounce((nome: string, cpf: string) => {
        buscarAtletasCol(nome, cpf);
      }, 350),
    [perfil?.escola_id, opcaoColetivaSelecionada?.id]
  );

  useEffect(() => {
    if (!perfil?.escola_id) return;
    setQNomeCol("");
    setQCpfCol("");
    setAtletasCol([]);
    setAtletaSelColId("");
    if (opcaoColetivaSelecionada) carregarAtletasTop10Col();
  }, [opcaoColetivaSelecionada?.id, perfil?.escola_id]);

  useEffect(() => {
    if (!opcaoColetivaSelecionada) return;
    debouncedBuscarCol(qNomeCol, qCpfCol);
  }, [qNomeCol, qCpfCol, debouncedBuscarCol, opcaoColetivaSelecionada]);

  // ---------- IND: provas/inscrições ----------
  async function carregarProvasAtivas(emIdNum: number) {
    setProvasAtivas([]);
    setEventoProvaId("");
    setInscInd([]);
    setInscProva([]);
    setVagasUsadas(0);

    const { data, error } = await supabase
      .from("evento_provas")
      .select("id, evento_modalidade_id, prova_id, max_por_escola, min_por_escola, ativo, provas(nome)")
      .eq("evento_modalidade_id", emIdNum)
      .eq("ativo", true)
      .order("id");

    if (error) return setMsg("Erro evento_provas: " + error.message);
    setProvasAtivas((data ?? []) as any);
  }

  async function carregarInscricoesIndividuais(emIdNum: number) {
    setInscInd([]);
    const { data, error } = await supabase
      .from("inscricoes_individuais")
      .select("id, atleta_id, status")
      .eq("evento_modalidade_id", emIdNum)
      .eq("status", "ATIVA");

    if (error) return setMsg("Erro inscricoes_individuais: " + error.message);
    setInscInd((data ?? []) as any);
  }

  async function carregarInscricoesProva(epIdNum: number) {
    setInscProva([]);
    if (!perfil?.escola_id) return;

    const { data, error } = await supabase
      .from("inscricoes_provas")
      .select("id, atleta_id, status")
      .eq("evento_prova_id", epIdNum)
      .eq("escola_id", perfil.escola_id)
      .eq("status", "ATIVA");

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

  async function inscreverIndividualOuProva() {
    setMsg("");
    if (!exigirEventoAberto()) return;

    const atletaId = Number(atletaSelId);
    if (!atletaId) return setMsg("Selecione um atleta na lista.");
    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");

    const atleta = atletas.find((x) => x.id === atletaId);
    if ((atleta?.doc_status ?? "PENDENTE") !== "CONCLUIDO") {
      return setMsg("Docs do atleta não estão CONCLUÍDOS.");
    }

    const emIdNum = Number(emIdInd);
    if (!emIdNum) return setMsg("Selecione uma modalidade individual.");
    if (provasAtivas.length > 0 && !eventoProvaId) return setMsg("Selecione uma prova.");

    // PROVA
    if (eventoProvaId) {
      const epIdNum = Number(eventoProvaId);
      const ep = provasAtivas.find((p) => p.id === epIdNum);
      if (!ep) return setMsg("Configuração da prova não encontrada.");

      const max = ep.max_por_escola ?? 0;
      if (max > 0 && vagasUsadas >= max) return setMsg("Limite de atletas atingido para esta prova.");

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

    // INDIVIDUAL (sem prova)
    const { data: jaAtivaInd, error: eAtivaInd } = await supabase
      .from("inscricoes_individuais")
      .select("id")
      .eq("evento_modalidade_id", emIdNum)
      .eq("atleta_id", atletaId)
      .eq("status", "ATIVA")
      .maybeSingle();

    if (eAtivaInd) return setMsg("Erro ao verificar inscrição: " + eAtivaInd.message);
    if (jaAtivaInd?.id) return setMsg("Este atleta já está inscrito nesta modalidade.");

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

    const { error } = await supabase.from("inscricoes_individuais").insert({
      evento_modalidade_id: emIdNum,
      atleta_id: atletaId,
      status: "ATIVA",
    });

    if (error) return setMsg("Erro ao inscrever: " + error.message);

    setMsg("Inscrição realizada ✅");
    await carregarInscricoesIndividuais(emIdNum);
  }

  async function cancelarInscricaoIndividualOuProva(id: number, tipo: "INDIVIDUAL" | "PROVA") {
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
    const emIdNum = Number(emIdInd);
    if (emIdNum) await carregarInscricoesIndividuais(emIdNum);
  }

  // ---------- COLETIVA: equipes ----------
  async function carregarEquipes(emIdNum: number) {
    if (!perfil) return;
    setEquipes([]);
    setEquipeId("");
    setMembros([]);

    const { data, error } = await supabase
      .from("equipes")
      .select("id, nome, status, evento_modalidade_id")
      .eq("evento_modalidade_id", emIdNum)
      .eq("escola_id", perfil.escola_id)
      .neq("status", "CANCELADO")
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro equipes: " + error.message);
    setEquipes((data ?? []) as any);
  }

  async function carregarMembros(equipeIdNum: number) {
    setMembros([]);
    const { data, error } = await supabase.from("equipe_membros").select("id, atleta_id").eq("equipe_id", equipeIdNum);
    if (error) return setMsg("Erro membros: " + error.message);
    setMembros((data ?? []) as any);
  }

  const membrosSet = useMemo(() => new Set(membros.map((m) => m.atleta_id)), [membros]);

  const minEquipe = opcaoColetivaSelecionada?.min_por_equipe ?? 0;
  const maxEquipe = opcaoColetivaSelecionada?.max_por_equipe ?? 999999;

  async function criarEquipe() {
    setMsg("");
    if (!exigirEventoAberto()) return;
    if (!perfil || !opcaoColetivaSelecionada) return setMsg("Selecione a modalidade coletiva.");

    const nomeEquipe = `${opcaoColetivaSelecionada.modalidades?.nome ?? "Equipe"} ${opcaoColetivaSelecionada.naipe} ${opcaoColetivaSelecionada.categoria}`;

    const { data, error } = await supabase
      .from("equipes")
      .insert({
        evento_modalidade_id: opcaoColetivaSelecionada.id,
        escola_id: perfil.escola_id,
        municipio_id: perfil.municipio_id,
        nome: nomeEquipe,
        status: "PENDENTE",
      })
      .select("id")
      .maybeSingle();

    if (error) return setMsg("Erro ao criar equipe: " + error.message);

    setMsg("Equipe criada ✅");
    await carregarEquipes(opcaoColetivaSelecionada.id);
    if (data?.id) {
      setEquipeId(String(data.id));
      await carregarMembros(data.id);
    }
  }

  async function adicionarMembro(atleta: Atleta) {
    setMsg("");
    if (!exigirEventoAberto()) return;

    const eqid = Number(equipeId);
    if (!eqid) return setMsg("Selecione uma equipe.");

    if (membrosSet.has(atleta.id)) return setMsg("Esse atleta já está na equipe.");
    if (membros.length >= maxEquipe) return setMsg(`Equipe cheia. Máx: ${maxEquipe === 999999 ? "∞" : maxEquipe}`);

    const { error } = await supabase.from("equipe_membros").insert({ equipe_id: eqid, atleta_id: atleta.id });
    if (error) return setMsg("Erro ao adicionar: " + error.message);

    setMsg("Atleta adicionado ✅");
    await carregarMembros(eqid);
  }

  async function adicionarMembroSelecionado() {
    setMsg("");
    if (!exigirEventoAberto()) return;

    const eqid = Number(equipeId);
    if (!eqid) return setMsg("Selecione/crie uma equipe.");
    const atletaId = Number(atletaSelColId);
    if (!atletaId) return setMsg("Selecione um atleta na lista (coletiva).");

    const atleta = atletasCol.find((a) => a.id === atletaId);
    if (!atleta) return setMsg("Atleta não encontrado na lista.");
    if ((atleta.doc_status ?? "PENDENTE") !== "CONCLUIDO") return setMsg("Docs do atleta não estão CONCLUÍDOS.");

    return adicionarMembro(atleta);
  }

  async function removerMembro(atletaId: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;

    const eqid = Number(equipeId);
    if (!eqid) return;

    const { error } = await supabase.from("equipe_membros").delete().eq("equipe_id", eqid).eq("atleta_id", atletaId);
    if (error) return setMsg("Erro ao remover: " + error.message);

    setMsg("Atleta removido ✅");
    await carregarMembros(eqid);
  }

  async function concluirEquipe() {
    setMsg("");
    if (!exigirEventoAberto()) return;

    const eqid = Number(equipeId);
    if (!eqid) return setMsg("Selecione uma equipe.");

    if (membros.length < minEquipe) return setMsg(`Mínimo não atingido. Min: ${minEquipe}`);
    if (membros.length > maxEquipe) return setMsg(`Máximo excedido. Máx: ${maxEquipe === 999999 ? "∞" : maxEquipe}`);

    const { error } = await supabase.from("equipes").update({ status: "CONCLUIDO" }).eq("id", eqid);
    if (error) return setMsg("Erro ao concluir: " + error.message);

    setMsg("Equipe concluída ✅");
    const emid = Number(emIdCol);
    if (emid) await carregarEquipes(emid);
  }

  async function cancelarEquipe(eqid: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;
    if (bloqueado) return setMsg("Inscrições encerradas para este evento.");

    const { error } = await supabase.from("equipes").update({ status: "CANCELADO" }).eq("id", eqid);
    if (error) return setMsg("Erro ao cancelar equipe: " + error.message);

    await supabase.from("equipe_membros").delete().eq("equipe_id", eqid);

    setMsg("Equipe cancelada ✅");
    const emid = Number(emIdCol);
    if (emid) await carregarEquipes(emid);
    setEquipeId("");
    setMembros([]);
  }

  async function excluirEquipe(eqid: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;
    if (bloqueado) return setMsg("Inscrições encerradas para este evento.");

    await supabase.from("equipe_membros").delete().eq("equipe_id", eqid);
    const { error } = await supabase.from("equipes").delete().eq("id", eqid);

    if (error) return setMsg("Não consegui excluir (provável vínculo). Use CANCELAR. Detalhe: " + error.message);

    setMsg("Equipe excluída ✅");
    const emid = Number(emIdCol);
    if (emid) await carregarEquipes(emid);
    setEquipeId("");
    setMembros([]);
  }

  // =================== NOVO: Comissão Técnica (funções) ===================
  async function carregarTecnicosTop10() {
    if (!perfil?.escola_id) return;
    setCarregandoTec(true);

    const { data, error } = await supabase
      .from("comissao_tecnica")
      .select("id, escola_id, nome, cpf, funcao, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(10);

    setCarregandoTec(false);
    if (error) return setMsg("Erro comissão técnica: " + error.message);

    const rows = (data ?? []) as any as Tecnico[];
    setTecnicos(rows);
    setTecnicoSelId(rows[0]?.id ? String(rows[0].id) : "");
  }

  async function buscarTecnicos(nome: string, cpf: string) {
    if (!perfil?.escola_id) return;

    const nomeTrim = (nome ?? "").trim();
    const cpfLimpo = onlyDigits(cpf);

    if (!nomeTrim && !cpfLimpo) {
      await carregarTecnicosTop10();
      return;
    }
    if (nomeTrim && nomeTrim.length < 2 && !cpfLimpo) return;

    setCarregandoTec(true);

    let q = supabase
      .from("comissao_tecnica")
      .select("id, escola_id, nome, cpf, funcao, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true);

    if (nomeTrim) q = q.ilike("nome", `%${nomeTrim}%`);
    if (cpfLimpo) q = q.ilike("cpf", `%${cpfLimpo}%`);

    const { data, error } = await q.order("nome", { ascending: true }).limit(50);

    setCarregandoTec(false);
    if (error) return setMsg("Erro ao buscar comissão técnica: " + error.message);

    const rows = (data ?? []) as any as Tecnico[];
    setTecnicos(rows);
    setTecnicoSelId(rows[0]?.id ? String(rows[0].id) : "");
  }

  const debouncedBuscarTec = useMemo(
    () =>
      debounce((nome: string, cpf: string) => {
        buscarTecnicos(nome, cpf);
      }, 350),
    [perfil?.escola_id]
  );

  useEffect(() => {
    if (!perfil?.escola_id) return;
    carregarTecnicosTop10();
  }, [perfil?.escola_id]);

  useEffect(() => {
    debouncedBuscarTec(qTecNome, qTecCpf);
  }, [qTecNome, qTecCpf, debouncedBuscarTec]);

  async function carregarTecnicosDoEvento(evId: number) {
    if (!perfil?.escola_id) return;
    setTecnicosEvento([]);

    const { data, error } = await supabase
      .from("evento_comissao_tecnica")
      .select(
        `
        id, evento_id, comissao_id, escola_id, status,
        comissao_tecnica:comissao_id ( id, nome, cpf, funcao )
      `
      )
      .eq("evento_id", evId)
      .eq("escola_id", perfil.escola_id)
      .neq("status", "CANCELADO")
      .order("id", { ascending: false });

    if (error) return setMsg("Erro ao carregar comissão do evento: " + error.message);
    setTecnicosEvento((data ?? []) as any);
  }

  async function adicionarTecnicoNoEvento() {
    setMsg("");
    if (!exigirEventoAberto()) return;
    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");
    const evId = Number(eventoId);
    if (!evId) return setMsg("Selecione um evento.");
    const tecId = Number(tecnicoSelId);
    if (!tecId) return setMsg("Selecione um membro da comissão.");

    // evita duplicar
    const ja = tecnicosEvento.find((x) => Number(x.comissao_id) === tecId);
    if (ja) return setMsg("Esse membro já está alocado neste evento.");

    const { error } = await supabase.from("evento_comissao_tecnica").insert({
      evento_id: evId,
      comissao_id: tecId,
      escola_id: perfil.escola_id,
      status: "ATIVO",
    });

    if (error) return setMsg("Erro ao alocar comissão no evento: " + error.message);

    setMsg("Comissão técnica alocada no evento ✅");
    await carregarTecnicosDoEvento(evId);
  }

  async function removerTecnicoDoEvento(vinculoId: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;
    const evId = Number(eventoId);
    if (!evId) return;

    // aqui eu marco como CANCELADO (recomendado). Se você preferir deletar, troca por delete().
    const { error } = await supabase
      .from("evento_comissao_tecnica")
      .update({ status: "CANCELADO" })
      .eq("id", vinculoId);

    if (error) return setMsg("Erro ao remover comissão do evento: " + error.message);

    setMsg("Removido do evento ✅");
    await carregarTecnicosDoEvento(evId);
  }
  // =======================================================================

  // ---------- effects ----------
  useEffect(() => {
    (async () => {
      setMsg("");
      const evId = Number(eventoId);

      // reseta comissão quando troca evento
      setTecnicosEvento([]);
      setQTecNome("");
      setQTecCpf("");
      setTecnicoSelId("");

      if (!evId) return;

      await carregarEventoModalidades(evId);
      await carregarTecnicosDoEvento(evId); // ✅ NOVO
    })();
  }, [eventoId]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const emIdNum = Number(emIdInd);
      if (!emIdNum) return;

      await carregarProvasAtivas(emIdNum);
      await carregarInscricoesIndividuais(emIdNum);
    })();
  }, [emIdInd]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const epIdNum = Number(eventoProvaId);
      if (!epIdNum) return;
      await carregarInscricoesProva(epIdNum);
      await carregarVagasUsadas(epIdNum);
    })();
  }, [eventoProvaId]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const emIdNum = Number(emIdCol);
      if (!emIdNum) return;
      await carregarEquipes(emIdNum);
    })();
  }, [emIdCol]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const eqid = Number(equipeId);
      if (!eqid) return;
      await carregarMembros(eqid);
    })();
  }, [equipeId]);

  const opcoesIndividuais = useMemo(
    () => eventoModalidades.filter((x) => x.modalidades?.tipo === "INDIVIDUAL"),
    [eventoModalidades]
  );

  const opcoesColetivas = useMemo(
    () => eventoModalidades.filter((x) => x.modalidades?.tipo === "COLETIVA"),
    [eventoModalidades]
  );

  const atletaSelecionado = useMemo(() => {
    const id = Number(atletaSelId);
    return atletas.find((a) => a.id === id) ?? null;
  }, [atletas, atletaSelId]);

  const podeInscreverIndividual =
    !!atletaSelId &&
    !!emIdInd &&
    !bloqueado &&
    !(provasAtivas.length > 0 && !eventoProvaId) &&
    (atletaSelecionado?.doc_status ?? "PENDENTE") === "CONCLUIDO";

  const inscritosAtivosInd = useMemo(() => {
    if (eventoProvaId) return inscProva.length;
    return inscInd.length;
  }, [inscInd, inscProva, eventoProvaId]);

  const tecnicoSelecionado = useMemo(() => {
    const id = Number(tecnicoSelId);
    return tecnicos.find((t) => t.id === id) ?? null;
  }, [tecnicoSelId, tecnicos]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontWeight: 900, fontSize: 22 }}>Gestor • Inscrições</h2>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, background: "#fff7e6", border: "1px solid #ffe58f", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      {/* EVENTO */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
        <div style={{ padding: 10, fontWeight: 800 }}>Evento</div>
        <div style={{ padding: 10 }}>
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} style={{ width: "100%", padding: 10 }}>
            <option value="">Selecione...</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome} {ev.inscricoes_abertas === false ? "(Encerrado)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ✅ NOVO: Comissão Técnica (por evento) */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
        <div style={{ padding: 10, fontWeight: 900 }}>Comissão Técnica (por evento)</div>

        {!eventoId && <div style={{ padding: 10, opacity: 0.8 }}>Selecione um evento para alocar a comissão técnica.</div>}

        {!!eventoId && (
          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Nome</div>
                <input
                  placeholder="Pesquisar..."
                  value={qTecNome}
                  onChange={(e) => setQTecNome(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>CPF</div>
                <input
                  placeholder="Somente números"
                  value={qTecCpf}
                  onChange={(e) => setQTecCpf(onlyDigits(e.target.value))}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
              </div>
            </div>

            <select
              size={6}
              value={tecnicoSelId}
              onChange={(e) => setTecnicoSelId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              {carregandoTec && <option>Carregando...</option>}
              {!carregandoTec && tecnicos.length === 0 && <option>Nenhum membro encontrado.</option>}
              {!carregandoTec &&
                tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} {t.funcao ? `— ${t.funcao}` : ""} {t.cpf ? `— CPF: ${t.cpf}` : ""}
                  </option>
                ))}
            </select>

            <button
              onClick={adicionarTecnicoNoEvento}
              disabled={!tecnicoSelId || bloqueado}
              style={{
                padding: 10,
                borderRadius: 8,
                cursor: !tecnicoSelId || bloqueado ? "not-allowed" : "pointer",
                opacity: !tecnicoSelId || bloqueado ? 0.6 : 1,
              }}
              title={bloqueado ? "Inscrições encerradas" : ""}
            >
              Alocar no evento
            </button>

            <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Alocados neste evento</div>

              {tecnicosEvento.length === 0 && <div style={{ padding: 6, opacity: 0.8 }}>Nenhum alocado ainda.</div>}

              {tecnicosEvento.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: 10,
                    borderTop: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {v.comissao_tecnica?.nome ?? `Comissão #${v.comissao_id}`}
                      {v.comissao_tecnica?.funcao ? ` — ${v.comissao_tecnica.funcao}` : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {v.comissao_tecnica?.cpf ? `CPF: ${v.comissao_tecnica.cpf}` : ""}
                    </div>
                  </div>

                  <button
                    onClick={() => removerTecnicoDoEvento(v.id)}
                    disabled={bloqueado}
                    style={{ padding: 10, borderRadius: 8, cursor: bloqueado ? "not-allowed" : "pointer", opacity: bloqueado ? 0.6 : 1 }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            {tecnicoSelecionado && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Selecionado: <b>{tecnicoSelecionado.nome}</b> {tecnicoSelecionado.funcao ? `(${tecnicoSelecionado.funcao})` : ""}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* INDIVIDUAIS */}
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
          <div style={{ padding: 10, fontWeight: 900 }}>Individuais / Provas</div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Modalidade individual (categoria/naipe)</div>
              <select value={emIdInd} onChange={(e) => setEmIdInd(e.target.value)} style={{ width: "100%", padding: 10 }} disabled={!eventoId}>
                <option value="">Selecione...</option>
                {opcoesIndividuais.map((em) => (
                  <option key={em.id} value={em.id}>
                    {emLabel(em)}
                  </option>
                ))}
              </select>
            </div>

            {provasAtivas.length > 0 && (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Prova</div>
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
              Inscritos ativos (sua escola): <b>{inscritosAtivosInd}</b>
            </div>
          </div>

          {/* Buscar atletas + Inscrever */}
          <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Buscar atletas</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Nome</div>
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
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginTop: 10 }}
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

            <button
              onClick={inscreverIndividualOuProva}
              disabled={!podeInscreverIndividual}
              style={{
                marginTop: 10,
                width: "100%",
                padding: 10,
                borderRadius: 8,
                cursor: podeInscreverIndividual ? "pointer" : "not-allowed",
                opacity: podeInscreverIndividual ? 1 : 0.6,
              }}
            >
              Inscrever (individual/prova)
            </button>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Mostrando <b>{Math.min(atletas.length, 50)}</b> resultados.
            </div>
          </div>

          {/* Lista inscritos / cancelar */}
          <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              Inscritos (sua escola) {eventoProvaId ? "• por prova" : "• por modalidade"}
            </div>

            {eventoProvaId ? (
              <>
                {inscProva.length === 0 && <div style={{ padding: 8 }}>Nenhuma inscrição.</div>}
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
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{atleta?.nome ?? `Atleta #${i.atleta_id}`}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Status: <b>{i.status}</b>
                        </div>
                      </div>
                      <button onClick={() => cancelarInscricaoIndividualOuProva(i.id, "PROVA")} disabled={bloqueado} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {inscInd.length === 0 && <div style={{ padding: 8 }}>Nenhuma inscrição.</div>}
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
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{atleta?.nome ?? `Atleta #${i.atleta_id}`}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Status: <b>{i.status}</b>
                        </div>
                      </div>
                      <button onClick={() => cancelarInscricaoIndividualOuProva(i.id, "INDIVIDUAL")} disabled={bloqueado} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* COLETIVAS */}
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
          <div style={{ padding: 10, fontWeight: 900 }}>Coletivas / Equipes</div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Modalidade coletiva (categoria/naipe)</div>
              <select value={emIdCol} onChange={(e) => setEmIdCol(e.target.value)} style={{ width: "100%", padding: 10 }} disabled={!eventoId}>
                <option value="">Selecione...</option>
                {opcoesColetivas.map((em) => (
                  <option key={em.id} value={em.id}>
                    {emLabel(em)} • equipe {em.min_por_equipe ?? "—"}–{em.max_por_equipe ?? "—"}
                  </option>
                ))}
              </select>
            </div>

            {opcaoColetivaSelecionada && (
              <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 800 }}>{opcaoColetivaSelecionada.modalidades?.nome}</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Tamanho permitido: {minEquipe} até {maxEquipe === 999999 ? "∞" : maxEquipe}
                </div>
              </div>
            )}

            <button onClick={criarEquipe} disabled={!opcaoColetivaSelecionada || bloqueado} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
              Criar equipe
            </button>

            <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }} disabled={equipes.length === 0}>
              <option value="">Selecione a equipe...</option>
              {equipes.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  #{eq.id} • {eq.nome} • {eq.status}
                </option>
              ))}
            </select>

            {equipeId && (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={concluirEquipe} disabled={bloqueado} style={{ flex: 1, padding: 10, borderRadius: 8, cursor: "pointer" }}>
                  Concluir equipe
                </button>

                <button onClick={() => cancelarEquipe(Number(equipeId))} disabled={bloqueado} style={{ flex: 1, padding: 10, borderRadius: 8, cursor: "pointer" }}>
                  Cancelar equipe
                </button>
              </div>
            )}

            {equipeId && (
              <button onClick={() => excluirEquipe(Number(equipeId))} disabled={bloqueado} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                Excluir equipe (apagar)
              </button>
            )}
          </div>

          {/* buscar atletas coletiva */}
          <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Buscar atletas elegíveis (coletiva)</div>

            {!opcaoColetivaSelecionada && <div style={{ padding: 8 }}>Selecione a modalidade coletiva para listar atletas elegíveis.</div>}

            {opcaoColetivaSelecionada && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Nome</div>
                    <input placeholder="Pesquise..." value={qNomeCol} onChange={(e) => setQNomeCol(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>CPF</div>
                    <input placeholder="Informe o CPF" value={qCpfCol} onChange={(e) => setQCpfCol(onlyDigits(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
                  </div>
                </div>

                <select size={10} value={atletaSelColId} onChange={(e) => setAtletaSelColId(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginTop: 10 }}>
                  {carregandoCol && <option>Carregando...</option>}
                  {!carregandoCol && atletasCol.length === 0 && <option>Nenhum atleta elegível encontrado.</option>}
                  {!carregandoCol &&
                    atletasCol.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} — {a.sexo === "M" ? "Masc" : "Fem"} — {calcCategoria(a.data_nascimento)} — Docs: {a.doc_status}
                      </option>
                    ))}
                </select>

                <button
                  onClick={adicionarMembroSelecionado}
                  disabled={!equipeId || !atletaSelColId || bloqueado}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    cursor: !equipeId || !atletaSelColId || bloqueado ? "not-allowed" : "pointer",
                    opacity: !equipeId || !atletaSelColId || bloqueado ? 0.6 : 1,
                  }}
                >
                  Adicionar selecionado na equipe
                </button>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  Mostrando <b>{Math.min(atletasCol.length, 50)}</b> resultados (top 10 no início).
                </div>
              </>
            )}
          </div>

          {/* membros */}
          <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Membros da equipe</div>
            {!equipeId && <div style={{ padding: 8 }}>Selecione/crie uma equipe.</div>}

            {equipeId &&
              membros.map((m) => {
                const atleta = atletasCol.find((a) => a.id === m.atleta_id) || atletas.find((a) => a.id === m.atleta_id);
                return (
                  <div key={m.id} style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{atleta?.nome ?? `Atleta #${m.atleta_id}`}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{atleta ? `${atleta.sexo} • ${calcCategoria(atleta.data_nascimento)}` : ""}</div>
                    </div>
                    <button onClick={() => removerMembro(m.atleta_id)} disabled={bloqueado} style={{ padding: 8, borderRadius: 8 }}>
                      Remover
                    </button>
                  </div>
                );
              })}

            {equipeId && (
              <div style={{ padding: 10, fontSize: 13, opacity: 0.9 }}>
                Total: <b>{membros.length}</b> / <b>{maxEquipe === 999999 ? "∞" : maxEquipe}</b>
              </div>
            )}
          </div>

          {/* lista equipes */}
          <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Equipes (sua escola) • ações</div>

            {equipes.length === 0 && <div style={{ padding: 8 }}>Nenhuma equipe.</div>}

            {equipes.map((eq) => (
              <div key={eq.id} style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>
                    #{eq.id} • {eq.nome}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Status: <b>{eq.status}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEquipeId(String(eq.id))} style={{ padding: 8, borderRadius: 8 }}>
                    Abrir
                  </button>
                  <button onClick={() => cancelarEquipe(eq.id)} disabled={bloqueado} style={{ padding: 8, borderRadius: 8 }}>
                    Cancelar
                  </button>
                  <button onClick={() => excluirEquipe(eq.id)} disabled={bloqueado} style={{ padding: 8, borderRadius: 8 }}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
