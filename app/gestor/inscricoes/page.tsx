"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = {
  escola_id: number;
  municipio_id: number;
  tipo?: string;
  ativo?: boolean;
};

type Evento = {
  id: number;
  nome: string;
  municipio_id: number | null;
  inscricoes_abertas?: boolean;
};

type Modalidade = { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" };

type EventoModalidade = {
  id: number;
  evento_id: number;
  modalidade_id: number;
  categoria: string;
  naipe: string;
};

type Atleta = {
  id: number;
  nome: string;
  sexo: "M" | "F";
  ativo: boolean;

  // docs
  status_doc?: "PENDENTE" | "CONCLUIDO" | string;
  foto_url?: string | null;
  id_frente_url?: string | null;
  id_verso_url?: string | null;
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

type InscricaoInd = { id: number; atleta_id: number; status: string };
type InscricaoProva = { id: number; atleta_id: number; status: string };

// ---------- helpers ----------
function extFromName(name: string) {
  const p = name.split(".");
  if (p.length < 2) return "bin";
  return p[p.length - 1].toLowerCase();
}

async function uploadToBucket(file: File, path: string) {
  const { data, error } = await supabase.storage.from("jers-docs").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  // se seu bucket estiver PUBLIC, isso funciona:
  const { data: pub } = supabase.storage.from("jers-docs").getPublicUrl(data.path);
  return pub.publicUrl as string;
}

export default function GestorInscricoesPage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [ems, setEms] = useState<EventoModalidade[]>([]);
  const [eventoProvas, setEventoProvas] = useState<EventoProva[]>([]);
  const [atletas, setAtletas] = useState<Atleta[]>([]);

  // selecionados
  const [eventoId, setEventoId] = useState<string>("");
  const [modalidadeId, setModalidadeId] = useState<string>("");
  const [emId, setEmId] = useState<string>("");
  const [eventoProvaId, setEventoProvaId] = useState<string>("");

  // trava por evento
  const [eventoAberto, setEventoAberto] = useState<boolean>(true);

  // controle vagas prova
  const [limiteMax, setLimiteMax] = useState<number>(0);
  const [usadas, setUsadas] = useState<number>(0);

  const [busca, setBusca] = useState("");

  // inscrições mostradas
  const [inscInd, setInscInd] = useState<InscricaoInd[]>([]);
  const [inscProva, setInscProva] = useState<InscricaoProva[]>([]);

  // -------- NOVO: uploads --------
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [filesByAtleta, setFilesByAtleta] = useState<
    Record<
      number,
      { foto?: File | null; frente?: File | null; verso?: File | null }
    >
  >({});

  function setFile(atletaId: number, key: "foto" | "frente" | "verso", file: File | null) {
    setFilesByAtleta((prev) => ({
      ...prev,
      [atletaId]: { ...(prev[atletaId] ?? {}), [key]: file },
    }));
  }

  function atletaDocsOK(a: Atleta) {
    // Regra do bloqueio de competição:
    // Só entra em competição se status_doc === CONCLUIDO.
    return (a.status_doc ?? "PENDENTE") === "CONCLUIDO";
  }

  async function enviarDocsDoAtleta(atleta: Atleta) {
    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");
    const pack = filesByAtleta[atleta.id] ?? {};
    if (!pack.foto && !pack.frente && !pack.verso) {
      setMsg("Selecione pelo menos 1 arquivo para enviar.");
      return;
    }

    try {
      setMsg("");
      setUploadingId(atleta.id);

      const base = `atletas/${perfil.escola_id}/${atleta.id}`;
      const now = Date.now();

      const patch: Partial<Atleta> = {};

      if (pack.foto) {
        const url = await uploadToBucket(
          pack.foto,
          `${base}/foto-${now}.${extFromName(pack.foto.name)}`
        );
        patch.foto_url = url;
      }

      if (pack.frente) {
        const url = await uploadToBucket(
          pack.frente,
          `${base}/id-frente-${now}.${extFromName(pack.frente.name)}`
        );
        patch.id_frente_url = url;
      }

      if (pack.verso) {
        const url = await uploadToBucket(
          pack.verso,
          `${base}/id-verso-${now}.${extFromName(pack.verso.name)}`
        );
        patch.id_verso_url = url;
      }

      // IMPORTANTE:
      // aqui a gente NÃO coloca CONCLUIDO automaticamente.
      // fica PENDENTE até alguém do admin validar.
      patch.status_doc = "PENDENTE";

      const { error } = await supabase.from("atletas").update(patch).eq("id", atleta.id);
      if (error) throw error;

      // atualiza lista local
      setAtletas((prev) =>
        prev.map((x) => (x.id === atleta.id ? { ...x, ...patch } : x))
      );

      // limpa arquivos do atleta
      setFilesByAtleta((prev) => ({ ...prev, [atleta.id]: {} }));

      setMsg("Arquivos enviados ✅ (documentação fica PENDENTE até validar)");
    } catch (e: any) {
      setMsg("Erro no upload: " + (e?.message ?? String(e)));
    } finally {
      setUploadingId(null);
    }
  }

  // -------- helpers --------
  const atletasById = useMemo(() => {
    const m = new Map<number, Atleta>();
    atletas.forEach((a) => m.set(a.id, a));
    return m;
  }, [atletas]);

  const emFiltradas = useMemo(() => {
    const eid = Number(eventoId);
    const mid = Number(modalidadeId);
    if (!eid || !mid) return [];
    return ems.filter((x) => x.evento_id === eid && x.modalidade_id === mid);
  }, [ems, eventoId, modalidadeId]);

  const provasAtivas = useMemo(() => {
    const emid = Number(emId);
    if (!emid) return [];
    return eventoProvas.filter((p) => p.evento_modalidade_id === emid && p.ativo);
  }, [eventoProvas, emId]);

  const inscritoSet = useMemo(() => {
    const s = new Set<number>();
    if (eventoProvaId) {
      inscProva
        .filter((i) => i.status === "ATIVA" || i.status === "ATIVO")
        .forEach((i) => s.add(i.atleta_id));
    } else {
      inscInd
        .filter((i) => i.status === "ATIVA" || i.status === "ATIVO")
        .forEach((i) => s.add(i.atleta_id));
    }
    return s;
  }, [inscInd, inscProva, eventoProvaId]);

  const atletasDisponiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const base = atletas.filter((a) => a.ativo && !inscritoSet.has(a.id));
    if (!b) return base;
    return base.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, busca, inscritoSet]);

  function labelEM(x: EventoModalidade) {
    const cat = x.categoria;
    const n = x.naipe === "M" ? "Masculino" : "Feminino";
    return `${cat} • ${n}`;
  }

  function exigirEventoAberto(): boolean {
    if (!eventoAberto) {
      setMsg("Inscrições encerradas para este evento.");
      return false;
    }
    return true;
  }

  async function carregarEventoAberto(eventoIdNum: number) {
    const { data, error } = await supabase
      .from("eventos")
      .select("id, inscricoes_abertas")
      .eq("id", eventoIdNum)
      .maybeSingle();

    if (error) {
      setEventoAberto(false);
      setMsg("Erro ao verificar inscrições do evento: " + error.message);
      return;
    }

    setEventoAberto(!!(data as any)?.inscricoes_abertas);
  }

  // -------- load base --------
  async function carregarPerfil() {
    setMsg("Carregando perfil...");
    const { data: sessionData, error: sErr } = await supabase.auth.getSession();
    if (sErr) return setMsg("Erro sessão: " + sErr.message);

    const userId = sessionData.session?.user?.id;
    if (!userId) return setMsg("Sem sessão. Faça login novamente.");

    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id, tipo, ativo")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id) return setMsg("Perfil sem escola_id.");
    if (data.ativo === false) return setMsg("Seu acesso está inativo.");

    setPerfil(data as Perfil);
    setMsg("");
  }

  async function carregarBase() {
    const ev = await supabase
      .from("eventos")
      .select("id, nome, municipio_id, inscricoes_abertas")
      .order("created_at", { ascending: false });

    if (ev.error) setMsg("Erro eventos: " + ev.error.message);
    setEventos((ev.data ?? []) as any);

    const mod = await supabase.from("modalidades").select("id, nome, tipo").order("nome");
    if (mod.error) setMsg("Erro modalidades: " + mod.error.message);
    setModalidades((mod.data ?? []) as any);

    const em = await supabase
      .from("evento_modalidades")
      .select("id, evento_id, modalidade_id, categoria, naipe");
    if (em.error) setMsg("Erro evento_modalidades: " + em.error.message);
    setEms((em.data ?? []) as any);

    const ep = await supabase
      .from("evento_provas")
      .select("id, evento_modalidade_id, prova_id, max_por_escola, min_por_escola, ativo, provas(nome)")
      .order("id");
    if (ep.error) setMsg("Erro evento_provas: " + ep.error.message);
    setEventoProvas((ep.data ?? []) as any);
  }

  async function carregarAtletasDaEscola(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo, ativo, status_doc, foto_url, id_frente_url, id_verso_url")
      .eq("escola_id", escolaId)
      .order("nome");

    if (error) return setMsg("Erro atletas: " + error.message);
    setAtletas((data ?? []) as any);
  }

  // -------- load inscrições --------
  async function carregarInscricoesIndividuais(emIdNum: number) {
    setInscInd([]);
    if (!perfil?.escola_id) return;

    const { data, error } = await supabase
      .from("inscricoes_individuais")
      .select("id, atleta_id, status")
      .eq("evento_modalidade_id", emIdNum);

    if (error) return setMsg("Erro inscrições individuais: " + error.message);

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

    if (error) return setMsg("Erro inscrições da prova: " + error.message);
    setInscProva((data ?? []) as any);
  }

  async function carregarVagasUsadas(epIdNum: number) {
    if (!perfil?.escola_id) return;

    const { count, error } = await supabase
      .from("inscricoes_provas")
      .select("*", { count: "exact", head: true })
      .eq("evento_prova_id", epIdNum)
      .eq("escola_id", perfil.escola_id)
      .in("status", ["ATIVA", "ATIVO"]);

    if (error) return;
    setUsadas(count ?? 0);
  }

  // -------- actions --------
  async function inscrever(atletaId: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;

    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");
    const emIdNum = Number(emId);
    if (!emIdNum) return setMsg("Selecione categoria/naipe (evento_modalidade).");
    if (provasAtivas.length > 0 && !eventoProvaId) return setMsg("Selecione uma prova.");

    // ✅ BLOQUEIO POR DOCUMENTAÇÃO
    const atleta = atletas.find((a) => a.id === atletaId);
    if (!atleta) return setMsg("Atleta não encontrado na lista.");

    if (!atletaDocsOK(atleta)) {
      return setMsg(
        `Documentação do atleta está "${atleta.status_doc ?? "PENDENTE"}". ` +
          `Envie os arquivos e aguarde validação (CONCLUIDO) para inscrever em competição.`
      );
    }

    if (eventoProvaId) {
      const epIdNum = Number(eventoProvaId);
      const ep = provasAtivas.find((p) => p.id === epIdNum);
      if (!ep) return setMsg("Configuração da prova não encontrada.");

      const max = ep.max_por_escola ?? 0;

      const { count, error: cErr } = await supabase
        .from("inscricoes_provas")
        .select("*", { count: "exact", head: true })
        .eq("evento_prova_id", epIdNum)
        .eq("escola_id", perfil.escola_id)
        .in("status", ["ATIVA", "ATIVO"]);

      if (cErr) return setMsg("Erro ao validar limite: " + cErr.message);
      if ((count ?? 0) >= max) return setMsg(`Limite atingido nesta prova: ${count}/${max}`);

      const { error } = await supabase.from("inscricoes_provas").insert({
        evento_prova_id: epIdNum,
        atleta_id: atletaId,
        escola_id: perfil.escola_id,
        status: "ATIVA",
      });

      if (error) return setMsg("Erro ao inscrever na prova: " + error.message);

      setMsg("Inscrição na prova realizada ✅");
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

  async function cancelarInscricao(id: number) {
    setMsg("");
    if (!exigirEventoAberto()) return;

    if (eventoProvaId) {
      const { error } = await supabase
        .from("inscricoes_provas")
        .update({ status: "CANCELADA" })
        .eq("id", id);

      if (error) return setMsg("Erro ao cancelar: " + error.message);

      setMsg("Cancelada ✅");
      const epIdNum = Number(eventoProvaId);
      await carregarInscricoesProva(epIdNum);
      await carregarVagasUsadas(epIdNum);
      return;
    }

    const { error } = await supabase
      .from("inscricoes_individuais")
      .update({ status: "CANCELADA" })
      .eq("id", id);

    if (error) return setMsg("Erro ao cancelar: " + error.message);

    setMsg("Cancelada ✅");
    await carregarInscricoesIndividuais(Number(emId));
  }

  // -------- effects --------
  useEffect(() => {
    carregarPerfil();
    carregarBase();
  }, []);

  useEffect(() => {
    if (!perfil?.escola_id) return;
    carregarAtletasDaEscola(perfil.escola_id);
  }, [perfil?.escola_id]);

  useEffect(() => {
    const eid = Number(eventoId);

    setEmId("");
    setEventoProvaId("");
    setLimiteMax(0);
    setUsadas(0);
    setInscInd([]);
    setInscProva([]);

    if (!eid || !Number.isFinite(eid)) {
      setEventoAberto(false);
      return;
    }

    carregarEventoAberto(eid);
  }, [eventoId]);

  useEffect(() => {
    setEmId("");
    setEventoProvaId("");
    setLimiteMax(0);
    setUsadas(0);
    setInscInd([]);
    setInscProva([]);
  }, [modalidadeId]);

  useEffect(() => {
    const emIdNum = Number(emId);
    setEventoProvaId("");
    setLimiteMax(0);
    setUsadas(0);
    setInscInd([]);
    setInscProva([]);

    if (!emIdNum) return;

    const list = eventoProvas.filter((p) => p.evento_modalidade_id === emIdNum && p.ativo);
    if (list.length === 1) {
      setEventoProvaId(String(list[0].id));
      setLimiteMax(list[0].max_por_escola ?? 0);
    }

    carregarInscricoesIndividuais(emIdNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emId]);

  useEffect(() => {
    const epIdNum = Number(eventoProvaId);
    if (!epIdNum) {
      setLimiteMax(0);
      setUsadas(0);
      setInscProva([]);
      if (emId) carregarInscricoesIndividuais(Number(emId));
      return;
    }

    const ep = provasAtivas.find((p) => p.id === epIdNum);
    setLimiteMax(ep?.max_por_escola ?? 0);

    carregarInscricoesProva(epIdNum);
    carregarVagasUsadas(epIdNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoProvaId]);

  // -------- render helpers --------
  const inscritosList = useMemo(() => {
    if (eventoProvaId) return inscProva.map((i) => ({ ...i, kind: "prova" as const }));
    return inscInd.map((i) => ({ ...i, kind: "ind" as const }));
  }, [inscProva, inscInd, eventoProvaId]);

  const bloqueado = !eventoAberto;

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gestor • Inscrição Individual</h1>

      {eventoId && bloqueado && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          <b>Inscrições encerradas neste evento.</b>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Você pode visualizar, mas não pode inscrever/cancelar.
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      {/* Seletores */}
      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr", alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Evento</div>
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {eventos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Modalidade</div>
          <select value={modalidadeId} onChange={(e) => setModalidadeId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {modalidades
              .filter((m) => m.tipo === "INDIVIDUAL")
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Categoria / Naipe</div>
          <select value={emId} onChange={(e) => setEmId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {emFiltradas.map((x) => (
              <option key={x.id} value={x.id}>
                {labelEM(x)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PROVAS */}
      {provasAtivas.length > 0 && (
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Prova</div>

          <select
            value={eventoProvaId}
            onChange={(e) => setEventoProvaId(e.target.value)}
            style={{ padding: 10, width: "100%", marginTop: 8 }}
          >
            <option value="">Selecione...</option>
            {provasAtivas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provas?.nome ?? `Prova #${p.prova_id}`} (max {p.max_por_escola})
              </option>
            ))}
          </select>

          {eventoProvaId && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              Vagas usadas: <b>{usadas}</b> / <b>{limiteMax}</b>
            </div>
          )}
        </div>
      )}

      {/* Painel 2 colunas */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Lista de atletas */}
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 800 }}>Atletas da escola</div>

          <div style={{ padding: 10 }}>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar atleta..."
              style={{ padding: 10, width: "100%" }}
            />
          </div>

          {atletasDisponiveis.slice(0, 120).map((a) => {
            const statusDoc = a.status_doc ?? "PENDENTE";
            const okDocs = atletaDocsOK(a);
            const uploading = uploadingId === a.id;

            return (
              <div key={a.id} style={{ padding: 10, borderTop: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.nome}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {a.sexo === "M" ? "Masculino" : "Feminino"} • Docs: <b>{statusDoc}</b>
                    </div>
                  </div>

                  <button
                    onClick={() => inscrever(a.id)}
                    style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                    disabled={
                      bloqueado ||
                      !emId ||
                      (provasAtivas.length > 0 && !eventoProvaId) ||
                      !okDocs
                    }
                    title={
                      bloqueado
                        ? "Inscrições encerradas"
                        : !emId
                        ? "Selecione categoria/naipe"
                        : provasAtivas.length > 0 && !eventoProvaId
                        ? "Selecione a prova"
                        : !okDocs
                        ? "Documentação precisa estar CONCLUIDO para competir"
                        : "Inscrever"
                    }
                  >
                    Inscrever
                  </button>
                </div>

                {/* Upload docs (não trava o sistema; só bloqueia competição até CONCLUIDO) */}
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Enviar documentos (bucket: <b>jers-docs</b>) — fica <b>PENDENTE</b> até validação
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Foto</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(a.id, "foto", e.target.files?.[0] ?? null)}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>ID Frente</div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setFile(a.id, "frente", e.target.files?.[0] ?? null)}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>ID Verso</div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setFile(a.id, "verso", e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => enviarDocsDoAtleta(a)}
                      disabled={uploading}
                      style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                    >
                      {uploading ? "Enviando..." : "Enviar documentos"}
                    </button>

                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {a.foto_url ? "✅ Foto" : "❌ Foto"} •{" "}
                      {a.id_frente_url ? "✅ Frente" : "❌ Frente"} •{" "}
                      {a.id_verso_url ? "✅ Verso" : "❌ Verso"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {atletasDisponiveis.length === 0 && (
            <div style={{ padding: 12, opacity: 0.85 }}>Nenhum atleta disponível.</div>
          )}
        </div>

        {/* Inscritos */}
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 800 }}>
            Inscritos (sua escola) {eventoProvaId ? "• por prova" : "• por modalidade"}
          </div>

          {inscritosList.map((i: any) => {
            const atleta = atletasById.get(i.atleta_id);
            return (
              <div
                key={`${i.kind}-${i.id}`}
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
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Status: {i.status}</div>
                </div>

                {(i.status === "ATIVA" || i.status === "ATIVO") && (
                  <button
                    onClick={() => cancelarInscricao(i.id)}
                    disabled={bloqueado}
                    style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                    title={bloqueado ? "Inscrições encerradas" : "Cancelar"}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            );
          })}

          {inscritosList.length === 0 && (
            <div style={{ padding: 12, opacity: 0.85 }}>Nenhum inscrito ainda.</div>
          )}
        </div>
      </div>
    </main>
  );
}