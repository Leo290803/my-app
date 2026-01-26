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

type Atleta = { id: number; nome: string; sexo: "M" | "F" };

type Inscricao = { id: number; atleta_id: number; status: "ATIVA" | "CANCELADA" };

export default function GestorProvasPage() {
  const [msg, setMsg] = useState("");

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [ems, setEms] = useState<EventoModalidade[]>([]);
  const [eps, setEps] = useState<EventoProva[]>([]);

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);

  const [fEventoId, setFEventoId] = useState<string>("");
  const [fModalidadeId, setFModalidadeId] = useState<string>("");
  const [fEmId, setFEmId] = useState<string>("");
  const [fEpId, setFEpId] = useState<string>("");

  const [busca, setBusca] = useState("");

  const emFiltradas = useMemo(() => {
    const eid = Number(fEventoId);
    const mid = Number(fModalidadeId);
    return ems.filter((x) => (!eid || x.evento_id === eid) && (!mid || x.modalidade_id === mid));
  }, [ems, fEventoId, fModalidadeId]);

  const epsFiltradas = useMemo(() => {
    const emid = Number(fEmId);
    if (!emid) return [];
    return eps.filter((x) => x.evento_modalidade_id === emid && x.ativo);
  }, [eps, fEmId]);

  const epAtual = useMemo(() => {
    const id = Number(fEpId);
    return eps.find((x) => x.id === id) || null;
  }, [eps, fEpId]);

  const inscritosSet = useMemo(() => new Set(inscritos.filter(i => i.status === "ATIVA").map(i => i.atleta_id)), [inscritos]);

  const atletasFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const base = atletas.filter((a) => !inscritosSet.has(a.id));
    if (!b) return base;
    return base.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, busca, inscritosSet]);

  async function carregarPerfil() {
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id")
      .maybeSingle();

    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id || !data?.municipio_id) return setMsg("Perfil sem escola/município.");
    setPerfil(data as Perfil);
  }

  async function carregarListas() {
    // eventos do município do gestor (ou todos se evento tiver municipio null)
    const ev = await supabase
      .from("eventos")
      .select("id, nome, municipio_id")
      .order("created_at", { ascending: false });

    if (ev.error) setMsg("Erro eventos: " + ev.error.message);
    setEventos((ev.data ?? []) as any);

    const mod = await supabase.from("modalidades").select("id, nome, tipo").order("nome");
    setModalidades((mod.data ?? []) as any);

    const em = await supabase.from("evento_modalidades").select("id, evento_id, modalidade_id, categoria, naipe");
    setEms((em.data ?? []) as any);

    const ep = await supabase
      .from("evento_provas")
      .select("id, evento_modalidade_id, prova_id, max_por_escola, min_por_escola, ativo, provas(nome)")
      .order("id");
    setEps((ep.data ?? []) as any);
  }

  async function carregarAtletas(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("nome");

    if (error) return setMsg("Erro atletas: " + error.message);
    setAtletas((data ?? []) as any);
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

    const epId = Number(fEpId);
    if (!epId) return setMsg("Selecione uma prova.");
    const ep = epAtual;
    if (!ep) return setMsg("Config da prova não encontrada.");

    // valida limite por escola
    const usados = inscritos.filter((i) => i.status === "ATIVA").length;
    if (usados >= ep.max_por_escola) {
      return setMsg(`Limite atingido: ${usados}/${ep.max_por_escola} para esta prova.`);
    }

    const { error } = await supabase.from("inscricoes_provas").insert({
      evento_prova_id: epId,
      atleta_id: atletaId,
      escola_id: perfil.escola_id,
      status: "ATIVA",
    });

    if (error) return setMsg("Erro ao inscrever: " + error.message);

    setMsg("Inscrição realizada ✅");
    carregarInscritos(epId);
  }

  async function cancelar(inscId: number) {
    const { error } = await supabase.from("inscricoes_provas").update({ status: "CANCELADA" }).eq("id", inscId);
    if (error) return setMsg("Erro ao cancelar: " + error.message);
    setMsg("Cancelada ✅");
    carregarInscritos(Number(fEpId));
  }

  function atletaNome(id: number) {
    return atletas.find((a) => a.id === id)?.nome ?? `Atleta #${id}`;
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    carregarListas();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    carregarAtletas(perfil.escola_id);
  }, [perfil]);

  useEffect(() => {
    // reset em/prova quando muda evento/modalidade
    setFEmId("");
    setFEpId("");
    setInscritos([]);
  }, [fEventoId, fModalidadeId]);

  useEffect(() => {
    // reset prova quando muda EM
    setFEpId("");
    setInscritos([]);
  }, [fEmId]);

  useEffect(() => {
    const epId = Number(fEpId);
    setInscritos([]);
    if (!epId) return;
    carregarInscritos(epId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fEpId]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestor • Inscrição por Prova</h1>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}

      <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Evento</div>
          <select value={fEventoId} onChange={(e) => setFEventoId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {eventos.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Modalidade</div>
          <select value={fModalidadeId} onChange={(e) => setFModalidadeId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {modalidades.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Categoria/Naipe</div>
          <select value={fEmId} onChange={(e) => setFEmId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {emFiltradas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.categoria} • {x.naipe}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Prova</div>
          <select value={fEpId} onChange={(e) => setFEpId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {epsFiltradas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.provas?.nome ?? `Prova #${x.prova_id}`} (max {x.max_por_escola})
              </option>
            ))}
          </select>
        </div>
      </div>

      {epAtual && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          Limite por escola: <b>{inscritos.filter(i => i.status === "ATIVA").length}/{epAtual.max_por_escola}</b>
        </div>
      )}

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
            <div key={a.id} style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{a.nome}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{a.sexo === "M" ? "Masculino" : "Feminino"}</div>
              </div>
              <button
                onClick={() => inscrever(a.id)}
                style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
                disabled={!fEpId}
              >
                Inscrever
              </button>
            </div>
          ))}

          {atletasFiltrados.length === 0 && <div style={{ padding: 12 }}>Nenhum atleta disponível.</div>}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ padding: 10, fontWeight: 700 }}>Inscritos na prova (sua escola)</div>

          {inscritos.map((i) => (
            <div key={i.id} style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{atletaNome(i.atleta_id)}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{i.status}</div>
              </div>
              {i.status === "ATIVA" ? (
                <button onClick={() => cancelar(i.id)} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                  Cancelar
                </button>
              ) : null}
            </div>
          ))}

          {inscritos.length === 0 && <div style={{ padding: 12 }}>Nenhum inscrito ainda.</div>}
        </div>
      </div>
    </main>
  );
}
