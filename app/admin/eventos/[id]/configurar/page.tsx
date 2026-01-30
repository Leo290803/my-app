"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

type Modalidade = { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" };

type EventoItem = { id: number; nome: string };

type EventoModalidade = {
  id: number;
  modalidade_id: number;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
  min_por_escola: number | null;
  max_por_escola: number | null;
  min_por_equipe: number | null;
  max_por_equipe: number | null;
  limite_substituicoes: number;
  ativo: boolean;
  modalidades: { nome: string; tipo: "INDIVIDUAL" | "COLETIVA" } | null;
};

export default function ConfigurarEventoPage() {
  const params = useParams();
  const rawId = (params as any)?.id;
  const eventoId = Number(Array.isArray(rawId) ? rawId[0] : rawId);

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [configs, setConfigs] = useState<EventoModalidade[]>([]);
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [msg, setMsg] = useState("");

  // form
  const [modalidadeId, setModalidadeId] = useState<string>("");
  const [categoria, setCategoria] = useState<"12-14" | "15-17">("12-14");
  const [naipe, setNaipe] = useState<"M" | "F">("M");

  const [minEscola, setMinEscola] = useState<string>("");
  const [maxEscola, setMaxEscola] = useState<string>("");

  const [minEquipe, setMinEquipe] = useState<string>("");
  const [maxEquipe, setMaxEquipe] = useState<string>("");

  const [limSub, setLimSub] = useState<string>("3");

  // copiar configs
  const [destEventoId, setDestEventoId] = useState<string>("");
  const [substituirDestino, setSubstituirDestino] = useState(false);
  const [copiando, setCopiando] = useState(false);

  const modalidadeSelecionada = useMemo(() => {
    const id = Number(modalidadeId);
    return modalidades.find((m) => m.id === id) ?? null;
  }, [modalidadeId, modalidades]);

  async function carregarModalidades() {
    const { data, error } = await supabase.from("modalidades").select("id, nome, tipo").order("nome");
    if (error) return setMsg("Erro ao carregar modalidades: " + error.message);
    setModalidades((data ?? []) as unknown as Modalidade[]);
  }

  async function carregarEventos() {
    const { data, error } = await supabase.from("eventos").select("id, nome").order("nome");
    if (error) return setMsg("Erro ao carregar eventos: " + error.message);
    setEventos((data ?? []) as any);
  }

  async function carregarConfigs() {
    const { data, error } = await supabase
      .from("evento_modalidades")
      .select(
        `
        id,
        modalidade_id,
        categoria,
        naipe,
        min_por_escola,
        max_por_escola,
        min_por_equipe,
        max_por_equipe,
        limite_substituicoes,
        ativo,
        modalidades ( nome, tipo )
      `
      )
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro ao carregar configs: " + error.message);
    setConfigs((data ?? []) as unknown as EventoModalidade[]);
  }

  async function adicionarConfig() {
    setMsg("");

    const mid = Number(modalidadeId);
    if (!mid) return setMsg("Selecione a modalidade.");

    const lim = Number(limSub) || 3;

    const payload: any = {
      evento_id: eventoId,
      modalidade_id: mid,
      categoria,
      naipe,
      limite_substituicoes: lim,
      ativo: true,
    };

    if (modalidadeSelecionada?.tipo === "INDIVIDUAL") {
      payload.min_por_escola = minEscola ? Number(minEscola) : null;
      payload.max_por_escola = maxEscola ? Number(maxEscola) : null;
      payload.min_por_equipe = null;
      payload.max_por_equipe = null;
    } else {
      payload.min_por_equipe = minEquipe ? Number(minEquipe) : null;
      payload.max_por_equipe = maxEquipe ? Number(maxEquipe) : null;
      payload.min_por_escola = null;
      payload.max_por_escola = null;
    }

    const { error } = await supabase.from("evento_modalidades").insert(payload);
    if (error) return setMsg("Erro ao salvar: " + error.message);

    setMsg("Configuração criada ✅");
    setModalidadeId("");
    setMinEscola("");
    setMaxEscola("");
    setMinEquipe("");
    setMaxEquipe("");
    setLimSub("3");

    carregarConfigs();
  }

  async function toggleAtivoConfig(c: EventoModalidade, ativo: boolean) {
    setMsg("");
    const { error } = await supabase.from("evento_modalidades").update({ ativo }).eq("id", c.id);
    if (error) return setMsg("Erro ao atualizar: " + error.message);

    setMsg(ativo ? "Config ativada ✅" : "Config desativada ✅");
    carregarConfigs();
  }

  async function excluirConfig(c: EventoModalidade) {
    const ok = window.confirm(
      `Excluir esta configuração?\n\n${c.modalidades?.nome ?? "—"} • ${c.categoria} • ${c.naipe}`
    );
    if (!ok) return;

    setMsg("");
    const { error } = await supabase.from("evento_modalidades").delete().eq("id", c.id);
    if (error) return setMsg("Erro ao excluir config: " + error.message);

    setMsg("Config excluída ✅");
    setConfigs((prev) => prev.filter((x) => x.id !== c.id));
  }

  async function copiarConfigsParaOutroEvento() {
    const destId = Number(destEventoId);
    if (!destId) return setMsg("Selecione o evento de destino.");

    const ok = window.confirm(
      `Copiar configurações do evento ${eventoId} para o evento ${destId}?\n\n${
        substituirDestino ? "Vai APAGAR as configs do destino antes." : "Vai apenas ADICIONAR no destino."
      }`
    );
    if (!ok) return;

    setMsg("");
    setCopiando(true);

    // 1) pega configs do atual
    const { data: origem, error: origemErr } = await supabase
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
      .eq("evento_id", eventoId);

    if (origemErr) {
      setCopiando(false);
      return setMsg("Erro ao buscar configs origem: " + origemErr.message);
    }

    const rows = (origem ?? []) as any[];

    // 2) se substituir, apaga configs do destino
    if (substituirDestino) {
      const { error: delErr } = await supabase.from("evento_modalidades").delete().eq("evento_id", destId);
      if (delErr) {
        setCopiando(false);
        return setMsg("Erro ao limpar destino: " + delErr.message);
      }
    }

    // 3) insere no destino
    if (rows.length > 0) {
      const payload = rows.map((r) => ({
        evento_id: destId,
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

      const { error: insErr } = await supabase.from("evento_modalidades").insert(payload);
      if (insErr) {
        setCopiando(false);
        return setMsg("Erro ao copiar configs: " + insErr.message);
      }
    }

    setCopiando(false);
    setMsg("Configs copiadas ✅");
  }

  useEffect(() => {
    if (!Number.isFinite(eventoId)) return;
    carregarModalidades();
    carregarEventos();
    carregarConfigs();
  }, [eventoId]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>
        Admin • Configurar Evento (ID: {Number.isFinite(eventoId) ? eventoId : "—"})
      </h1>

      {/* COPIAR CONFIGS */}
      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 10, padding: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Copiar configurações para outro evento</h2>

        <div style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 520 }}>
          <select
            value={destEventoId}
            onChange={(e) => setDestEventoId(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="">Selecione o evento destino...</option>
            {eventos
              .filter((x) => x.id !== eventoId)
              .map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome} (ID {ev.id})
                </option>
              ))}
          </select>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={substituirDestino}
              onChange={(e) => setSubstituirDestino(e.target.checked)}
            />
            <span>Substituir configs do destino (apagar antes)</span>
          </label>

          <button
            onClick={copiarConfigsParaOutroEvento}
            disabled={copiando}
            style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
          >
            {copiando ? "Copiando..." : "Copiar configurações"}
          </button>
        </div>
      </div>

      {/* ADICIONAR CONFIG */}
      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 10, padding: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Adicionar modalidade ao evento</h2>

        <div style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 520 }}>
          <select
            value={modalidadeId}
            onChange={(e) => setModalidadeId(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="">Selecione a modalidade...</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} ({m.tipo})
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as any)}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="12-14">12–14</option>
              <option value="15-17">15–17</option>
            </select>

            <select
              value={naipe}
              onChange={(e) => setNaipe(e.target.value as any)}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>

          {modalidadeSelecionada?.tipo === "INDIVIDUAL" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                placeholder="Min por escola (opcional)"
                value={minEscola}
                onChange={(e) => setMinEscola(e.target.value.replace(/\D/g, ""))}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
              />
              <input
                placeholder="Max por escola (ex: 2)"
                value={maxEscola}
                onChange={(e) => setMaxEscola(e.target.value.replace(/\D/g, ""))}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
              />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                placeholder="Min por equipe (ex: 5)"
                value={minEquipe}
                onChange={(e) => setMinEquipe(e.target.value.replace(/\D/g, ""))}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
              />
              <input
                placeholder="Max por equipe (ex: 12)"
                value={maxEquipe}
                onChange={(e) => setMaxEquipe(e.target.value.replace(/\D/g, ""))}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
              />
            </div>
          )}

          <input
            placeholder="Limite de substituições (padrão 3)"
            value={limSub}
            onChange={(e) => setLimSub(e.target.value.replace(/\D/g, ""))}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <button onClick={adicionarConfig} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
            Adicionar ao evento
          </button>

          {msg && <p>{msg}</p>}
        </div>
      </div>

      {/* LISTA CONFIGS */}
      <h2 style={{ marginTop: 18, fontSize: 18, fontWeight: 700 }}>Configurações criadas</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 10 }}>
        {configs.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 12,
              borderBottom: "1px solid #eee",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {c.modalidades ? c.modalidades.nome : "—"} • {c.categoria} • {c.naipe}
              {c.modalidades ? ` • ${c.modalidades.tipo}` : ""}
            </div>

            {c.modalidades?.tipo === "INDIVIDUAL" ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Limite por escola: {c.min_por_escola ?? "—"} até {c.max_por_escola ?? "—"} • Substituições:{" "}
                {c.limite_substituicoes}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Tamanho da equipe: {c.min_por_equipe ?? "—"} até {c.max_por_equipe ?? "—"} • Substituições:{" "}
                {c.limite_substituicoes}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
              {c.ativo ? (
                <button
                  onClick={() => toggleAtivoConfig(c, false)}
                  style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                >
                  Desativar
                </button>
              ) : (
                <button
                  onClick={() => toggleAtivoConfig(c, true)}
                  style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                >
                  Ativar
                </button>
              )}

              <button
                onClick={() => excluirConfig(c)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: "1px solid #fca5a5",
                  background: "#fee2e2",
                  color: "#991b1b",
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}

        {configs.length === 0 && <div style={{ padding: 12 }}>Nenhuma configuração ainda.</div>}
      </div>
    </main>
  );
}