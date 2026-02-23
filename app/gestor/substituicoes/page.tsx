"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number; municipio_id: number };

type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";

type Evento = {
  id: number;
  nome: string;
  status?: string | null;
};

type SubRow = {
  id: number;
  created_at: string;
  status: string;
  mensagem_gestor: string | null;
  equipe_id: number;
  atleta_saida_id: number;
  atleta_entrada_id: number;
  laudo_url: string | null;
};

type Equipe = {
  id: number;
  nome: string;
  status: "PENDENTE" | "CONCLUIDO" | "CANCELADO";
  evento_modalidade_id: number;
  evento_modalidades?: {
    id: number;
    evento_id: number;
    substituicoes_abertas?: boolean | null;
    ativo?: boolean | null;
    categoria: "12-14" | "15-17";
    naipe: "M" | "F";
    modalidades?: { nome: string; tipo: "INDIVIDUAL" | "COLETIVA" } | null;
    eventos?: { id: number; nome: string; status?: string | null } | null;
  } | null;
};

type Membro = { id: number; atleta_id: number };

type Atleta = {
  id: number;
  nome: string;
  cpf?: string | null;
  sexo: "M" | "F";
  data_nascimento?: string | null;
  doc_status?: DocStatus | null;
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

function calcCategoria(dataNascimento?: string | null) {
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

function fmtDataBR(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function GestorSubstituicoesPage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  // ✅ histórico das solicitações do gestor
  const [ultimas, setUltimas] = useState<SubRow[]>([]);

  // EVENTO
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>("");

  // EQUIPES
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeId] = useState<string>("");
  const [equipeSel, setEquipeSel] = useState<Equipe | null>(null);

  // MEMBROS
  const [membros, setMembros] = useState<Membro[]>([]);
  const [membrosDetalhe, setMembrosDetalhe] = useState<Atleta[]>([]);

  // BUSCA ATLETAS
  const [qNome, setQNome] = useState("");
  const [qCpf, setQCpf] = useState("");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [atletaSelId, setAtletaSelId] = useState<string>("");
  const [carregandoAtletas, setCarregandoAtletas] = useState(false);

  const [saidaId, setSaidaId] = useState<string>("");
  const [entradaId, setEntradaId] = useState<string>("");
  const [motivo, setMotivo] = useState("");

  // =========================================================
  // PERFIL
  async function carregarPerfil() {
    setMsg("");

    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return setMsg("Usuário não autenticado.");

    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id || !data?.municipio_id) return setMsg("Perfil sem escola/município.");
    setPerfil(data);
  }

  // =========================================================
  // ✅ ÚLTIMAS SOLICITAÇÕES (histórico do gestor)
  async function carregarUltimasSolicitacoes() {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from("substituicoes")
      .select("id, created_at, status, mensagem_gestor, equipe_id, atleta_saida_id, atleta_entrada_id, laudo_url")
      .eq("solicitante_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.warn("Erro últimas solicitações:", error.message);
      return;
    }
    setUltimas((data ?? []) as any);
  }

  // =========================================================
  // EVENTOS DISPONÍVEIS (baseado nas equipes da escola + evento_modalidades.substituicoes_abertas)
  async function carregarEventosDisponiveis(escolaId: number) {
    setMsg("");

    // 1) pega as equipes da escola (somente para descobrir quais evento_modalidade_id existem)
    const { data: eqBase, error: eqErr } = await supabase
      .from("equipes")
      .select("evento_modalidade_id")
      .eq("escola_id", escolaId)
      .neq("status", "CANCELADO");

    if (eqErr) return setMsg("Erro ao buscar equipes (base eventos): " + eqErr.message);

    const emIds = Array.from(
      new Set((eqBase ?? []).map((r: any) => Number(r.evento_modalidade_id)).filter(Boolean))
    );

    if (emIds.length === 0) {
      setEventos([]);
      return;
    }

    // 2) busca as configs (evento_modalidades) dessas equipes e filtra substituicoes_abertas = true
    const { data: emRows, error: emErr } = await supabase
      .from("evento_modalidades")
      .select(
        `
        id,
        evento_id,
        substituicoes_abertas,
        ativo,
        eventos:evento_id ( id, nome, status )
      `
      )
      .in("id", emIds)
      .eq("substituicoes_abertas", true)
      .eq("ativo", true);

    if (emErr) return setMsg("Erro ao buscar evento_modalidades (eventos): " + emErr.message);

    // 3) monta lista única de eventos
    const map = new Map<number, Evento>();
    (emRows ?? []).forEach((r: any) => {
      const ev = r?.eventos;
      if (!ev?.id) return;

      // se você quiser só eventos ABERTO:
      if (String(ev.status ?? "").toUpperCase() === "ENCERRADO") return;

      map.set(Number(ev.id), {
        id: Number(ev.id),
        nome: String(ev.nome ?? `Evento ${ev.id}`),
        status: ev.status ?? null,
      });
    });

    const lista = Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    setEventos(lista);

    // se o evento selecionado não existe mais, limpa
    if (eventoId && !lista.some((x) => String(x.id) === String(eventoId))) {
      setEventoId("");
    }
  }

  // =========================================================
  // EQUIPES DO EVENTO (só modalidades com substituições abertas)
  async function carregarEquipesDoEvento(escolaId: number, evId: number) {
    setMsg("");

    // 1) pega IDs das evento_modalidades desse evento que estão com substituições abertas
    const { data: em, error: emErr } = await supabase
      .from("evento_modalidades")
      .select("id")
      .eq("evento_id", evId)
      .eq("substituicoes_abertas", true)
      .eq("ativo", true);

    if (emErr) return setMsg("Erro evento_modalidades do evento: " + emErr.message);

    const emIds = (em ?? []).map((r: any) => Number(r.id)).filter(Boolean);

    if (emIds.length === 0) {
      setEquipes([]);
      return;
    }

    // 2) busca equipes da escola nessas configs
    const { data, error } = await supabase
      .from("equipes")
      .select(
        `
        id, nome, status, evento_modalidade_id,
        evento_modalidades:evento_modalidade_id (
          id, evento_id, substituicoes_abertas, ativo,
          categoria, naipe,
          modalidades ( nome, tipo )
        )
      `
      )
      .eq("escola_id", escolaId)
      .neq("status", "CANCELADO")
      .in("evento_modalidade_id", emIds)
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro equipes: " + error.message);
    setEquipes((data ?? []) as any);
  }

  async function carregarEquipeSelecionada(eqid: number) {
    const { data, error } = await supabase
      .from("equipes")
      .select(
        `
        id, nome, status, evento_modalidade_id,
        evento_modalidades:evento_modalidade_id (
          id, evento_id, substituicoes_abertas, ativo,
          categoria, naipe,
          modalidades ( nome, tipo )
        )
      `
      )
      .eq("id", eqid)
      .maybeSingle();

    if (error) return setMsg("Erro equipe: " + error.message);
    setEquipeSel((data ?? null) as any);
  }

  // =========================================================
  // MEMBROS
  async function carregarMembros(eqid: number) {
    const { data, error } = await supabase.from("equipe_membros").select("id, atleta_id").eq("equipe_id", eqid);
    if (error) return setMsg("Erro membros: " + error.message);
    setMembros((data ?? []) as any);
  }

  // =========================================================
  // DOC STATUS
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

  // =========================================================
  // ATLETAS (TOP10 + BUSCA)
  async function carregarAtletasTop10() {
    if (!perfil?.escola_id) return;
    setCarregandoAtletas(true);

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, data_nascimento")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(10);

    setCarregandoAtletas(false);
    if (error) return setMsg("Erro atletas: " + error.message);

    const merged = await anexarStatusDocs((data ?? []) as any[], perfil.escola_id);
    setAtletas(filtrarElegiveis(merged));
    setAtletaSelId(data?.[0]?.id ? String(data[0].id) : "");
  }

  function filtrarElegiveis(lista: Atleta[]) {
    // se ainda não escolheu equipe, mostra somente docs concluído (pra não vir vazio)
    if (!equipeSel?.evento_modalidades) {
      return lista.filter((a) => (a.doc_status ?? "PENDENTE") === "CONCLUIDO");
    }

    const { categoria, naipe } = equipeSel.evento_modalidades;

    return lista.filter((a) => {
      const okDocs = (a.doc_status ?? "PENDENTE") === "CONCLUIDO";
      const okSexo = a.sexo === naipe;
      const okCat = calcCategoria(a.data_nascimento) === categoria;
      return okDocs && okSexo && okCat;
    });
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
      .select("id, nome, cpf, sexo, data_nascimento")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true);

    if (nomeTrim) q = q.ilike("nome", `%${nomeTrim}%`);
    if (cpfLimpo) q = q.ilike("cpf", `%${cpfLimpo}%`);

    const { data, error } = await q.order("nome", { ascending: true }).limit(50);

    setCarregandoAtletas(false);
    if (error) return setMsg("Erro ao buscar atletas: " + error.message);

    const merged = await anexarStatusDocs((data ?? []) as any[], perfil.escola_id);
    setAtletas(filtrarElegiveis(merged));
    setAtletaSelId(data?.[0]?.id ? String(data[0].id) : "");
  }

  const debouncedBuscar = useMemo(
    () =>
      debounce((nome: string, cpf: string) => {
        buscarAtletas(nome, cpf);
      }, 350),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perfil?.escola_id, equipeSel?.id]
  );

  useEffect(() => {
    debouncedBuscar(qNome, qCpf);
  }, [qNome, qCpf, debouncedBuscar]);

  // =========================================================
  // candidatos: remove os que já estão na equipe
  const membrosSet = useMemo(() => new Set(membros.map((m) => m.atleta_id)), [membros]);
  const candidatosEntrada = useMemo(() => atletas.filter((a) => !membrosSet.has(a.id)), [atletas, membrosSet]);

  // =========================================================
  // detalhes dos membros
  async function carregarDetalheMembros(escolaId: number, ids: number[]) {
    if (ids.length === 0) {
      setMembrosDetalhe([]);
      return;
    }

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, sexo, data_nascimento")
      .eq("escola_id", escolaId)
      .in("id", ids);

    if (error) {
      console.warn("Erro detalhe membros:", error.message);
      setMembrosDetalhe([]);
      return;
    }

    const merged = await anexarStatusDocs((data ?? []) as any[], escolaId);
    setMembrosDetalhe(merged);
  }

  // =========================================================
  // AÇÃO PRINCIPAL
  async function enviarLaudoEsolicitar(file: File) {
    setMsg("");
    if (!perfil) return;

    const eqid = Number(equipeId);
    const saida = Number(saidaId);
    const entrada = Number(entradaId);

    if (!eventoId) return setMsg("Selecione o evento.");
    if (!eqid || !saida || !entrada) return setMsg("Selecione equipe, saída e entrada.");
    if (!motivo.trim()) return setMsg("Informe o motivo.");

    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const path = `${perfil.municipio_id}/${perfil.escola_id}/LAUDOS/${eqid}/${fileName}`;

    setMsg("Enviando laudo...");

    const up = await supabase.storage.from("jers-docs").upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (up.error) return setMsg("Erro upload laudo: " + up.error.message);

    const { data: pub } = supabase.storage.from("jers-docs").getPublicUrl(path);
    const laudoUrl = pub.publicUrl;

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("substituicoes").insert({
      equipe_id: eqid,
      atleta_saida_id: saida,
      atleta_entrada_id: entrada,
      solicitante_user_id: userData.user?.id,
      motivo: motivo.trim(),
      laudo_url: laudoUrl,
      status: "PENDENTE",

      // ✅ mensagem que o gestor vai ver depois (requer colunas no banco)
      mensagem_gestor: "Substituição enviada com sucesso. Aguarde a análise do Admin.",
      enviado_em: new Date().toISOString(),
    });

    if (error) return setMsg("Erro ao solicitar: " + error.message);

    setMsg("Solicitação enviada ✅ (aguardando aprovação do Admin)");
    setMotivo("");
    setSaidaId("");
    setEntradaId("");

    // ✅ atualiza o histórico na tela
    await carregarUltimasSolicitacoes();
  }

  // =========================================================
  // EFFECTS
  useEffect(() => {
    carregarPerfil();
  }, []);

  // ao carregar perfil: carrega eventos, top10 atletas e histórico
  useEffect(() => {
    if (!perfil) return;
    carregarEventosDisponiveis(perfil.escola_id);
    carregarAtletasTop10();
    carregarUltimasSolicitacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  // quando muda EVENTO: limpa tudo e carrega equipes do evento
  useEffect(() => {
    if (!perfil?.escola_id) return;

    setMsg("");
    setEquipeId("");
    setEquipeSel(null);
    setEquipes([]);
    setMembros([]);
    setMembrosDetalhe([]);
    setSaidaId("");
    setEntradaId("");

    const evId = Number(eventoId);
    if (!evId) return;

    carregarEquipesDoEvento(perfil.escola_id, evId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId, perfil?.escola_id]);

  // quando muda EQUIPE: carrega detalhes e membros
  useEffect(() => {
    const eqid = Number(equipeId);
    setMsg("");
    setMembros([]);
    setMembrosDetalhe([]);
    setSaidaId("");
    setEntradaId("");

    if (!eqid) {
      setEquipeSel(null);
      return;
    }

    (async () => {
      await carregarEquipeSelecionada(eqid);
      await carregarMembros(eqid);
    })();
  }, [equipeId]);

  useEffect(() => {
    if (!perfil?.escola_id) return;
    const ids = membros.map((m) => m.atleta_id);
    carregarDetalheMembros(perfil.escola_id, ids);
  }, [membros, perfil?.escola_id]);

  useEffect(() => {
    if (!perfil?.escola_id) return;
    carregarAtletasTop10();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipeSel?.id]);

  const podeEnviar = !!eventoId && !!equipeId && !!saidaId && !!entradaId && motivo.trim().length > 0;

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>Gestor • Solicitar Substituição</h1>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
        Fluxo: <b>Evento</b> → <b>Equipe</b> → <b>Saída</b> → <b>Entrada</b> → <b>Motivo/Laudo</b>.
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#fff7e6",
            border: "1px solid #ffe58f",
            borderRadius: 12,
          }}
        >
          {msg}
        </div>
      )}

      {/* ✅ HISTÓRICO (compacto) */}
<div
  style={{
    marginBottom: 12,
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 12,
    background: "#fff",
  }}
>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
    <div style={{ fontWeight: 900 }}>Últimas solicitações</div>

    <button
      onClick={carregarUltimasSolicitacoes}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #ddd",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: 12,
        background: "#fff",
      }}
      title="Atualizar histórico"
    >
      Atualizar
    </button>
  </div>

  {ultimas.length === 0 ? (
    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Nenhuma solicitação ainda.</div>
  ) : (
    <div
      style={{
        marginTop: 10,
        border: "1px solid #eee",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Cabeçalho */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 110px 1fr 90px",
          gap: 8,
          padding: "10px 12px",
          background: "#fafafa",
          borderBottom: "1px solid #eee",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        <div>ID</div>
        <div>Status</div>
        <div>Mensagem</div>
        <div>Laudo</div>
      </div>

      {/* Corpo com scroll */}
      <div style={{ maxHeight: 180, overflow: "auto" }}>
        {ultimas.map((s) => (
          <div
            key={s.id}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 110px 1fr 90px",
              gap: 8,
              padding: "10px 12px",
              borderBottom: "1px solid #f1f1f1",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 900 }}>#{s.id}</div>

            <div style={{ fontWeight: 900 }}>
              {String(s.status || "").toUpperCase()}
            </div>

            <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
              {s.mensagem_gestor ? s.mensagem_gestor : "—"}
              <div style={{ marginTop: 4, opacity: 0.6, fontSize: 11 }}>
                {new Date(s.created_at).toLocaleString("pt-BR")}
              </div>
            </div>

            <div>
              {s.laudo_url ? (
                <a
                  href={s.laudo_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontWeight: 900, fontSize: 12 }}
                >
                  Ver
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>

      {/* PASSO 1: EVENTO */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>1) Selecione o evento</div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd", minWidth: 320, flex: 1 }}
            >
              <option value="">Selecione o evento...</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  #{ev.id} • {ev.nome}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (!perfil?.escola_id) return;
                carregarEventosDisponiveis(perfil.escola_id);
              }}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer", fontWeight: 800 }}
            >
              Atualizar lista
            </button>
          </div>

          {eventos.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Nenhum evento disponível. Verifique se existe <b>evento_modalidades.substituicoes_abertas = true</b> para alguma equipe da sua
              escola.
            </div>
          )}
        </div>
      </div>

      {/* PASSO 2+ : GRID */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        {/* COLUNA ESQUERDA: EQUIPE + SAÍDA */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* PASSO 2: EQUIPE */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>2) Selecione a equipe</div>

            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <select
                value={equipeId}
                onChange={(e) => setEquipeId(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
                disabled={!eventoId}
              >
                <option value="">{!eventoId ? "Selecione o evento primeiro..." : "Selecione a equipe..."}</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    #{eq.id} • {eq.nome} • {eq.status}
                  </option>
                ))}
              </select>

              {equipeSel?.evento_modalidades && (
                <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>{equipeSel.evento_modalidades.modalidades?.nome ?? "Modalidade"}</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Categoria: <b>{equipeSel.evento_modalidades.categoria}</b> • Naipe:{" "}
                    <b>{equipeSel.evento_modalidades.naipe === "M" ? "Masculino" : "Feminino"}</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                    Apenas atletas com <b>Docs CONCLUÍDO</b> + categoria/naipe compatíveis aparecem para ENTRAR.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PASSO 3: SAÍDA (membros) */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>3) Escolha quem SAI (membros atuais)</div>

            {!equipeId && <div style={{ padding: 12, opacity: 0.8 }}>Selecione uma equipe para listar os membros.</div>}
            {equipeId && membrosDetalhe.length === 0 && <div style={{ padding: 12 }}>Nenhum membro encontrado.</div>}

            {equipeId &&
              membrosDetalhe.map((a) => {
                const selecionado = String(saidaId) === String(a.id);
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: 12,
                      borderTop: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      background: selecionado ? "#f6ffed" : "#fff",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>{a.nome}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {a.sexo} • {calcCategoria(a.data_nascimento)} • Docs: <b>{a.doc_status ?? "PENDENTE"}</b>
                      </div>
                    </div>

                    <button
                      onClick={() => setSaidaId(String(a.id))}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        cursor: "pointer",
                        fontWeight: 800,
                        opacity: equipeId ? 1 : 0.6,
                      }}
                      disabled={!equipeId}
                      title="Selecionar este atleta para SAIR"
                    >
                      {selecionado ? "✅ Selecionado" : "Selecionar saída"}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* COLUNA DIREITA: ENTRADA + MOTIVO/LAUDO */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* PASSO 4: ENTRADA */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>4) Escolha quem ENTRA</div>

            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Nome</div>
                  <input
                    placeholder="Pesquise..."
                    value={qNome}
                    onChange={(e) => setQNome(e.target.value)}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
                    disabled={!equipeId}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>CPF</div>
                  <input
                    placeholder="Somente números"
                    value={qCpf}
                    onChange={(e) => setQCpf(onlyDigits(e.target.value))}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
                    disabled={!equipeId}
                  />
                </div>
              </div>

              <select
                size={10}
                value={atletaSelId}
                onChange={(e) => setAtletaSelId(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                disabled={!equipeId}
              >
                {carregandoAtletas && <option>Carregando...</option>}
                {!carregandoAtletas && !equipeId && <option>Selecione uma equipe...</option>}
                {!carregandoAtletas && equipeId && candidatosEntrada.length === 0 && <option>Nenhum atleta elegível encontrado.</option>}
                {!carregandoAtletas &&
                  equipeId &&
                  candidatosEntrada.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} — {a.sexo === "M" ? "Masc" : "Fem"} — {calcCategoria(a.data_nascimento)} — Docs:{" "}
                      {a.doc_status ?? "PENDENTE"}
                    </option>
                  ))}
              </select>

              <button
                onClick={() => {
                  setEntradaId(atletaSelId);
                  if (!atletaSelId) return;
                  setMsg("Atleta selecionado para ENTRAR ✅");
                }}
                disabled={!equipeId || !atletaSelId}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  cursor: !equipeId || !atletaSelId ? "not-allowed" : "pointer",
                  opacity: !equipeId || !atletaSelId ? 0.6 : 1,
                  fontWeight: 900,
                }}
              >
                ✅ Confirmar atleta de ENTRADA
              </button>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Mostrando <b>{Math.min(candidatosEntrada.length, 50)}</b> resultados (Top 10 no início).
              </div>
            </div>
          </div>

          {/* PASSO 5: MOTIVO + LAUDO + ENVIAR */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>5) Motivo, laudo e envio</div>

            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Resumo</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Saída:{" "}
                  <b>{saidaId ? membrosDetalhe.find((x) => String(x.id) === String(saidaId))?.nome ?? "—" : "—"}</b>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Entrada:{" "}
                  <b>{entradaId ? candidatosEntrada.find((x) => String(x.id) === String(entradaId))?.nome ?? "—" : "—"}</b>
                </div>
              </div>

              <textarea
                placeholder="Motivo (ex: lesão — laudo anexado)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ padding: 12, minHeight: 110, borderRadius: 10, border: "1px solid #ddd" }}
                disabled={!equipeId}
              />

              <div style={{ fontSize: 12, opacity: 0.8 }}>Anexe o laudo (PDF/JPG/PNG). O envio só libera quando tudo estiver preenchido.</div>

              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviarLaudoEsolicitar(f);
                  e.currentTarget.value = "";
                }}
                disabled={!podeEnviar}
              />

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Para habilitar: selecione <b>evento</b>, <b>equipe</b>, <b>saída</b>, <b>entrada</b> e informe o <b>motivo</b>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESPONSIVO SIMPLES */}
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
        Dica: em telas pequenas, você pode trocar o grid por coluna única (se quiser, eu já te mando a versão com CSS responsivo).
      </div>
    </main>
  );
}