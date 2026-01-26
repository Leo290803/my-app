"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number; municipio_id: number };

type EventoModalidade = {
  id: number;
  categoria: "12-14" | "15-17";
  naipe: "M" | "F";
  modalidades: { nome: string; tipo: "INDIVIDUAL" | "COLETIVA" } | null;
};

type Equipe = { id: number; nome: string; status: string; evento_modalidade_id: number };

type Atleta = { id: number; nome: string };

type Membro = { id: number; atleta_id: number };

export default function GestorSubstituicoesPage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeId] = useState<string>("");

  const [membros, setMembros] = useState<Membro[]>([]);
  const [atletas, setAtletas] = useState<Atleta[]>([]);

  const [saidaId, setSaidaId] = useState<string>("");
  const [entradaId, setEntradaId] = useState<string>("");

  const [motivo, setMotivo] = useState("");

  async function carregarPerfil() {
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id")
      .maybeSingle();

    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id || !data?.municipio_id) return setMsg("Perfil sem escola/município.");
    setPerfil(data as Perfil);
  }

  async function carregarEquipes(escolaId: number) {
    const { data, error } = await supabase
      .from("equipes")
      .select("id, nome, status, evento_modalidade_id")
      .eq("escola_id", escolaId)
      .neq("status", "CANCELADO")
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro equipes: " + error.message);
    setEquipes((data ?? []) as any);
  }

  async function carregarMembros(eqid: number) {
    const { data, error } = await supabase
      .from("equipe_membros")
      .select("id, atleta_id")
      .eq("equipe_id", eqid);

    if (error) return setMsg("Erro membros: " + error.message);
    setMembros((data ?? []) as any);
  }

  async function carregarAtletas(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("nome");

    if (error) return setMsg("Erro atletas: " + error.message);
    setAtletas((data ?? []) as any);
  }

  const membrosSet = useMemo(() => new Set(membros.map((m) => m.atleta_id)), [membros]);
  const candidatosEntrada = useMemo(() => atletas.filter((a) => !membrosSet.has(a.id)), [atletas, membrosSet]);

  async function enviarLaudoEsolicitar(file: File) {
    setMsg("");
    if (!perfil) return;
    const eqid = Number(equipeId);
    const saida = Number(saidaId);
    const entrada = Number(entradaId);

    if (!eqid || !saida || !entrada) return setMsg("Selecione equipe, saída e entrada.");
    if (!motivo.trim()) return setMsg("Informe o motivo.");

    // upload laudo
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

    // cria solicitação
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("substituicoes").insert({
      equipe_id: eqid,
      atleta_saida_id: saida,
      atleta_entrada_id: entrada,
      solicitante_user_id: userData.user?.id,
      motivo: motivo.trim(),
      laudo_url: laudoUrl,
      status: "PENDENTE",
    });

    if (error) return setMsg("Erro ao solicitar: " + error.message);

    setMsg("Solicitação enviada ✅ (aguardando aprovação do Admin)");
    setMotivo("");
    setSaidaId("");
    setEntradaId("");
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    carregarEquipes(perfil.escola_id);
    carregarAtletas(perfil.escola_id);
  }, [perfil]);

  useEffect(() => {
    const eqid = Number(equipeId);
    setMembros([]);
    setSaidaId("");
    setEntradaId("");
    if (!eqid) return;
    carregarMembros(eqid);
  }, [equipeId]);

  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestor • Solicitar Substituição</h1>

      <div style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 620 }}>
        <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)} style={{ padding: 10 }}>
          <option value="">Selecione a equipe...</option>
          {equipes.map((eq) => (
            <option key={eq.id} value={eq.id}>
              #{eq.id} • {eq.nome} • {eq.status}
            </option>
          ))}
        </select>

        <select value={saidaId} onChange={(e) => setSaidaId(e.target.value)} style={{ padding: 10 }} disabled={!equipeId}>
          <option value="">Atleta que SAI...</option>
          {membros.map((m) => {
            const a = atletas.find((x) => x.id === m.atleta_id);
            return (
              <option key={m.id} value={m.atleta_id}>
                {a?.nome ?? `Atleta #${m.atleta_id}`}
              </option>
            );
          })}
        </select>

        <select value={entradaId} onChange={(e) => setEntradaId(e.target.value)} style={{ padding: 10 }} disabled={!equipeId}>
          <option value="">Atleta que ENTRA...</option>
          {candidatosEntrada.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Motivo (ex: lesão — laudo anexado)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          style={{ padding: 10, minHeight: 80 }}
        />

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Anexar laudo (PDF/JPG/PNG) e enviar solicitação:</div>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviarLaudoEsolicitar(f);
              e.currentTarget.value = "";
            }}
            disabled={!equipeId || !saidaId || !entradaId}
          />
        </div>

        {msg && <p>{msg}</p>}
      </div>
    </main>
  );
}
