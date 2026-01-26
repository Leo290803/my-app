"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

type Evento = { id: number; nome: string };
type Modalidade = { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" };

type EventoModalidade = {
  id: number;
  evento_id: number;
  modalidade_id: number;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
};

type Prova = { id: number; modalidade_id: number; nome: string; ativo: boolean };

type EventoProva = {
  id: number;
  evento_modalidade_id: number;
  prova_id: number;
  max_por_escola: number;
  min_por_escola: number;
  ativo: boolean;
};

export default function AdminConfigProvasPage() {
  const [msg, setMsg] = useState("");

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [eventoModalidades, setEventoModalidades] = useState<EventoModalidade[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [eventoProvas, setEventoProvas] = useState<EventoProva[]>([]);

  const [fEventoId, setFEventoId] = useState<string>("");
  const [fModalidadeId, setFModalidadeId] = useState<string>("");
  const [fEmId, setFEmId] = useState<string>("");

  const provasDaModalidade = useMemo(() => {
    const mid = Number(fModalidadeId);
    if (!mid) return [];
    return provas.filter((p) => p.modalidade_id === mid && p.ativo);
  }, [provas, fModalidadeId]);

  const emFiltradas = useMemo(() => {
    const eid = Number(fEventoId);
    const mid = Number(fModalidadeId);
    return eventoModalidades.filter((em) => (!eid || em.evento_id === eid) && (!mid || em.modalidade_id === mid));
  }, [eventoModalidades, fEventoId, fModalidadeId]);

  function epConfig(provaId: number) {
    const emid = Number(fEmId);
    return eventoProvas.find((x) => x.evento_modalidade_id === emid && x.prova_id === provaId);
  }

  async function loadAll() {
    const ev = await supabase.from("eventos").select("id, nome").order("created_at", { ascending: false });
    setEventos((ev.data ?? []) as any);

    const mod = await supabase.from("modalidades").select("id, nome, tipo").order("nome");
    setModalidades((mod.data ?? []) as any);

    const em = await supabase.from("evento_modalidades").select("id, evento_id, modalidade_id, categoria, naipe");
    setEventoModalidades((em.data ?? []) as any);

    const pr = await supabase.from("provas").select("id, modalidade_id, nome, ativo").order("nome");
    setProvas((pr.data ?? []) as any);

    const ep = await supabase.from("evento_provas").select("id, evento_modalidade_id, prova_id, max_por_escola, min_por_escola, ativo");
    setEventoProvas((ep.data ?? []) as any);
  }

  async function criarProva() {
    const mid = Number(fModalidadeId);
    if (!mid) return setMsg("Escolha uma modalidade.");
    const nome = prompt("Nome da prova (ex: 80m, 100m, revezamento...)")?.trim();
    if (!nome) return;

    const { error } = await supabase.from("provas").insert({ modalidade_id: mid, nome, tipo: "INDIVIDUAL", ativo: true });
    if (error) return setMsg("Erro: " + error.message);

    setMsg("Prova criada ✅");
    loadAll();
  }

  async function toggleAtivarNoEvento(provaId: number) {
    const emid = Number(fEmId);
    if (!emid) return setMsg("Selecione o evento_modalidade (categoria/naipe).");

    const atual = epConfig(provaId);

    if (!atual) {
      // cria
      const { error } = await supabase.from("evento_provas").insert({
        evento_modalidade_id: emid,
        prova_id: provaId,
        max_por_escola: 2,
        min_por_escola: 0,
        ativo: true,
      });
      if (error) return setMsg("Erro: " + error.message);
      setMsg("Prova ativada no evento ✅");
      loadAll();
      return;
    }

    // alterna ativo
    const { error } = await supabase.from("evento_provas").update({ ativo: !atual.ativo }).eq("id", atual.id);
    if (error) return setMsg("Erro: " + error.message);
    setMsg("Atualizado ✅");
    loadAll();
  }

  async function salvarLimites(provaId: number) {
    const atual = epConfig(provaId);
    if (!atual) return setMsg("Ative a prova no evento antes.");

    const max = Number(prompt("Max por escola:", String(atual.max_por_escola)) ?? atual.max_por_escola);
    const min = Number(prompt("Min por escola:", String(atual.min_por_escola)) ?? atual.min_por_escola);

    const { error } = await supabase
      .from("evento_provas")
      .update({ max_por_escola: max, min_por_escola: min })
      .eq("id", atual.id);

    if (error) return setMsg("Erro: " + error.message);
    setMsg("Limites salvos ✅");
    loadAll();
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setFEmId("");
  }, [fEventoId, fModalidadeId]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Configurar • Provas</h1>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}

      <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Evento</div>
          <select value={fEventoId} onChange={(e) => setFEventoId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {eventos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Modalidade</div>
          <select value={fModalidadeId} onChange={(e) => setFModalidadeId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {modalidades.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Categoria/Naipe (evento_modalidade)</div>
          <select value={fEmId} onChange={(e) => setFEmId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Selecione...</option>
            {emFiltradas.map((x) => (
              <option key={x.id} value={x.id}>
                EM #{x.id} • {x.categoria} • {x.naipe}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button onClick={criarProva} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          + Nova prova
        </button>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ padding: 10, fontWeight: 700 }}>Provas da modalidade</div>

        {provasDaModalidade.map((p) => {
          const cfg = epConfig(p.id);
          const ativoNoEvento = cfg?.ativo ?? false;

          return (
            <div key={p.id} style={{ padding: 10, borderTop: "1px solid #eee", display: "grid", gridTemplateColumns: "80px 1fr 120px 220px", gap: 10, alignItems: "center" }}>
              <div>#{p.id}</div>
              <div style={{ fontWeight: 600 }}>{p.nome}</div>

              <button onClick={() => toggleAtivarNoEvento(p.id)} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
                {ativoNoEvento ? "Desativar" : "Ativar"}
              </button>

              <button disabled={!cfg} onClick={() => salvarLimites(p.id)} style={{ padding: 10, borderRadius: 8, cursor: cfg ? "pointer" : "not-allowed" }}>
                Limites {cfg ? `(min ${cfg.min_por_escola} / max ${cfg.max_por_escola})` : "(—)"}
              </button>
            </div>
          );
        })}

        {provasDaModalidade.length === 0 && <div style={{ padding: 12 }}>Nenhuma prova cadastrada.</div>}
      </div>
    </main>
  );
}
