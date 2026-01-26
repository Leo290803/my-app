"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

type Modalidade = { id: number; nome: string; tipo: "INDIVIDUAL" | "COLETIVA" };

type EventoModalidade = {
  id: number;
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

  // ✅ Correção: evita NaN quando params.id vem estranho/undefined
  const rawId = (params as any)?.id;
  const eventoId = Number(Array.isArray(rawId) ? rawId[0] : rawId);

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [configs, setConfigs] = useState<EventoModalidade[]>([]);
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

  const modalidadeSelecionada = useMemo(() => {
    const id = Number(modalidadeId);
    return modalidades.find((m) => m.id === id) ?? null;
  }, [modalidadeId, modalidades]);

  async function carregarModalidades() {
    const { data, error } = await supabase
      .from("modalidades")
      .select("id, nome, tipo")
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar modalidades: " + error.message);
      return;
    }

    setModalidades((data ?? []) as unknown as Modalidade[]);
    setMsg(`Modalidades carregadas: ${(data ?? []).length}`);

  }

  async function carregarConfigs() {
    const { data, error } = await supabase
      .from("evento_modalidades")
      .select(
        `
        id,
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

    if (error) {
      setMsg("Erro ao carregar configs: " + error.message);
      return;
    }

    setConfigs((data ?? []) as unknown as EventoModalidade[]);
  }

  async function adicionarConfig() {
    setMsg("");

    const mid = Number(modalidadeId);
    if (!mid) {
      setMsg("Selecione a modalidade.");
      return;
    }

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

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setMsg("Configuração criada ✅");

    setModalidadeId("");
    setMinEscola("");
    setMaxEscola("");
    setMinEquipe("");
    setMaxEquipe("");
    setLimSub("3");

    carregarConfigs();
  }

  useEffect(() => {
    // ✅ evita travar quando eventoId ainda não é número válido
    if (!Number.isFinite(eventoId)) return;
    carregarModalidades();
    carregarConfigs();
  }, [eventoId]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>
        Admin • Configurar Evento (ID: {Number.isFinite(eventoId) ? eventoId : "—"})
      </h1>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 14,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>
          Adicionar modalidade ao evento
        </h2>

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

          <button
            onClick={adicionarConfig}
            style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
          >
            Adicionar ao evento
          </button>

          {msg && <p>{msg}</p>}
        </div>
      </div>

      <h2 style={{ marginTop: 18, fontSize: 18, fontWeight: 700 }}>
        Configurações criadas
      </h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 10 }}>
        {configs.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 12,
              borderBottom: "1px solid #eee",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {c.modalidades ? c.modalidades.nome : "—"} • {c.categoria} • {c.naipe}
              {c.modalidades ? ` • ${c.modalidades.tipo}` : ""}
            </div>

            {c.modalidades?.tipo === "INDIVIDUAL" ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Limite por escola: {c.min_por_escola ?? "—"} até {c.max_por_escola ?? "—"} •
                Substituições: {c.limite_substituicoes}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Tamanho da equipe: {c.min_por_equipe ?? "—"} até {c.max_por_equipe ?? "—"} •
                Substituições: {c.limite_substituicoes}
              </div>
            )}

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {c.ativo ? "Ativo" : "Inativo"}
            </div>
          </div>
        ))}
        {configs.length === 0 && <div style={{ padding: 12 }}>Nenhuma configuração ainda.</div>}
      </div>
    </main>
  );
}
