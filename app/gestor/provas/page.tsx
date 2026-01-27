"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number; municipio_id: number };

type Evento = { id: number; nome: string; municipio_id: number | null };

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

type Atleta = { id: number; nome: string; sexo: "M" | "F"; doc_status?: DocStatus | null };

type Inscrito = { id: number; atleta_id: number; status: string };

export default function GestorProvasPage() {
  const [msg, setMsg] = useState("");

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState("");

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [eventoModalidades, setEventoModalidades] = useState<EventoModalidade[]>([]);
  const [emId, setEmId] = useState("");

  const [provas, setProvas] = useState<Prova[]>([]);
  const [eventoProvas, setEventoProvas] = useState<EventoProva[]>([]);
  const [fEpId, setFEpId] = useState("");

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [inscritos, setInscritos] = useState<Inscrito[]>([]);

  const [busca, setBusca] = useState("");

  // -------- base --------
  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase.from("perfis").select("escola_id, municipio_id").maybeSingle();
      if (error) return setMsg("Erro perfil: " + error.message);
      if (!data?.escola_id) return setMsg("Perfil sem escola.");
      setPerfil(data as any);

      await carregarEventos();
      await carregarModalidades();
      await carregarProvas();
    })();
  }, []);

  async function carregarEventos() {
    const { data, error } = await supabase.from("eventos").select("id, nome, municipio_id").order("id", { ascending: false });
    if (error) return setMsg("Erro eventos: " + error.message);
    setEventos((data ?? []) as any);
  }

  async function carregarModalidades() {
    const { data, error } = await supabase.from("modalidades").select("id, nome, tipo").order("nome");
    if (error) return setMsg("Erro modalidades: " + error.message);
    setModalidades((data ?? []) as any);
  }

  async function carregarProvas() {
    const { data, error } = await supabase.from("provas").select("id, nome, modalidade_id").order("nome");
    if (error) return setMsg("Erro provas: " + error.message);
    setProvas((data ?? []) as any);
  }

  async function carregarEventoModalidades(evId: number) {
    setEventoModalidades([]);
    setEmId("");
    setEventoProvas([]);
    setFEpId("");
    setInscritos([]);

    const { data, error } = await supabase
      .from("evento_modalidades")
      .select("id, evento_id, modalidade_id, categoria, naipe")
      .eq("evento_id", evId)
      .order("id");

    if (error) return setMsg("Erro evento_modalidades: " + error.message);
    setEventoModalidades((data ?? []) as any);
  }

  async function carregarEventoProvas(emIdNum: number) {
    setEventoProvas([]);
    setFEpId("");
    setInscritos([]);

    const { data, error } = await supabase
      .from("evento_provas")
      .select("id, evento_modalidade_id, prova_id, max_por_escola, min_por_escola, ativo, provas(nome)")
      .eq("evento_modalidade_id", emIdNum)
      .eq("ativo", true)
      .order("id");

    if (error) return setMsg("Erro evento_provas: " + error.message);
    setEventoProvas((data ?? []) as any);
  }

  async function carregarAtletas(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("nome");

    if (error) return setMsg("Erro atletas: " + error.message);

    const atletasBase = (data ?? []) as any[];
    const ids = atletasBase.map((a) => a.id);

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

  async function carregarInscritos(epId: number) {
    if (!perfil) return;
    const { data, error } = await supabase
      .from("inscricoes_provas")
      .select("id, atleta_id, status")
      .eq("evento_prova_id", epId)
      .eq("escola_id", perfil.escola_id);

    if (error) return setMsg("Erro inscritos: " + error.message);
    setInscritos((data ?? []) as any);
  }

  async function inscrever(atletaId: number) {
    setMsg("");
    if (!perfil) return;

    const atleta = atletas.find((x) => x.id === atletaId);
    if (atleta && atleta.doc_status !== "CONCLUIDO") {
      return setMsg(
        `Atleta com documentos ${atleta.doc_status ?? "PENDENTE"}. Regularize (Foto/Identidade) e aguarde a conferência para poder inscrever.`
      );
    }

    const epId = Number(fEpId);
    if (!epId) return setMsg("Selecione uma prova.");

    const epAtual = eventoProvas.find((x) => x.id === epId);
    if (!epAtual) return setMsg("Prova inválida.");

    const ativos = inscritos.filter((i) => i.status === "ATIVA").length;
    if (epAtual.max_por_escola > 0 && ativos >= epAtual.max_por_escola) return setMsg("Limite por escola atingido.");

    const jaTem = inscritos.some((i) => i.atleta_id === atletaId && i.status === "ATIVA");
    if (jaTem) return setMsg("Atleta já inscrito nesta prova.");

    const { error } = await supabase.from("inscricoes_provas").insert({
      evento_prova_id: epId,
      atleta_id: atletaId,
      escola_id: perfil.escola_id,
      status: "ATIVA",
    });

    if (error) return setMsg("Erro ao inscrever: " + error.message);

    setMsg("Inscrito ✅");
    await carregarInscritos(epId);
  }

  async function cancelar(id: number) {
    setMsg("");
    const epId = Number(fEpId);
    if (!epId) return;

    const { error } = await supabase.from("inscricoes_provas").update({ status: "CANCELADA" }).eq("id", id);
    if (error) return setMsg("Erro ao cancelar: " + error.message);

    setMsg("Cancelado ✅");
    await carregarInscritos(epId);
  }

  // -------- effects --------
  useEffect(() => {
    (async () => {
      setMsg("");
      if (!perfil?.escola_id) return;
      await carregarAtletas(perfil.escola_id);
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
      await carregarEventoProvas(emIdNum);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emId]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const epId = Number(fEpId);
      if (!epId) return;
      await carregarInscritos(epId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fEpId]);

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

  const epAtual = useMemo(() => {
    const id = Number(fEpId);
    if (!id) return null;
    return eventoProvas.find((x) => x.id === id) ?? null;
  }, [fEpId, eventoProvas]);

  const atletasFiltrados = useMemo(() => {
    const b = busca.toLowerCase();
    return atletas.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, busca]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontWeight: 900, fontSize: 22 }}>Provas</h2>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, background: "#fff7e6", border: "1px solid #ffe58f", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 700 }}>Configuração</div>

          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Evento</div>
              <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} style={{ width: "100%", padding: 10 }}>
                <option value="">Selecione...</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nome}
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

            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Prova</div>
              <select value={fEpId} onChange={(e) => setFEpId(e.target.value)} style={{ width: "100%", padding: 10 }}>
                <option value="">Selecione...</option>
                {eventoProvas.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.provas?.nome ?? `Prova ${ep.prova_id}`} • max {ep.max_por_escola}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {epAtual && (
          <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ padding: 10, fontWeight: 700 }}>Resumo</div>
            <div style={{ padding: 10, fontSize: 13, opacity: 0.85 }}>
              Limite por escola:{" "}
              <b>
                {inscritos.filter((i) => i.status === "ATIVA").length}/{epAtual.max_por_escola}
              </b>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 700 }}>Inscrever atleta</div>
          <div style={{ padding: 10 }}>
            <input
              placeholder="Buscar atleta..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ padding: 10, width: "100%" }}
            />
          </div>

          {atletasFiltrados.slice(0, 80).map((a) => (
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
                <div style={{ fontWeight: 600 }}>{a.nome}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{a.sexo === "M" ? "Masculino" : "Feminino"}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Docs: <b>{a.doc_status ?? "PENDENTE"}</b>
                </div>
              </div>
              <button
                onClick={() => inscrever(a.id)}
                style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                disabled={!fEpId || (a.doc_status ?? "PENDENTE") !== "CONCLUIDO"}
                title={(a.doc_status ?? "PENDENTE") !== "CONCLUIDO" ? "Docs pendentes/rejeitados" : "Inscrever"}
              >
                Inscrever
              </button>
            </div>
          ))}

          {atletasFiltrados.length === 0 && <div style={{ padding: 12 }}>Nenhum atleta disponível.</div>}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 700 }}>Inscritos</div>

          {inscritos.length === 0 && <div style={{ padding: 12 }}>Nenhuma inscrição.</div>}

          {inscritos.map((i) => {
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
                  onClick={() => cancelar(i.id)}
                  style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                  disabled={!fEpId || i.status !== "ATIVA"}
                  title={i.status !== "ATIVA" ? "Não está ativa" : "Cancelar"}
                >
                  Cancelar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}