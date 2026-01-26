"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number; municipio_id: number };

type Atleta = { id: number; nome: string };
type Tec = { id: number; nome: string; funcao: string };

type Documento = {
  id: number;
  tipo_pessoa: "ATLETA" | "EQUIPE_TECNICA";
  pessoa_id: number;
  tipo_documento: "FOTO" | "FICHA" | "IDENTIDADE";
  arquivo_url: string;
  status: "PENDENTE" | "EM_ANALISE" | "CONCLUIDO" | "DEVOLVIDO";
  observacao: string | null;
};

const TIPOS_DOC = ["FOTO", "FICHA", "IDENTIDADE"] as const;

export default function GestorDocumentosPage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [aba, setAba] = useState<"ATLETA" | "EQUIPE_TECNICA">("ATLETA");

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [tecs, setTecs] = useState<Tec[]>([]);

  const [pessoaId, setPessoaId] = useState<string>("");
  const [tipoDoc, setTipoDoc] = useState<(typeof TIPOS_DOC)[number]>("FOTO");

  const [docs, setDocs] = useState<Documento[]>([]);

  async function carregarPerfil() {
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id")
      .maybeSingle();

    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id || !data?.municipio_id) return setMsg("Perfil sem escola/município.");
    setPerfil(data as Perfil);
  }

  async function carregarPessoas(escolaId: number) {
    const a = await supabase.from("atletas").select("id, nome").eq("escola_id", escolaId).order("nome");
    if (a.error) setMsg("Erro atletas: " + a.error.message);
    setAtletas((a.data ?? []) as unknown as Atleta[]);

    const t = await supabase
      .from("equipe_tecnica")
      .select("id, nome, funcao")
      .eq("escola_id", escolaId)
      .order("nome");
    if (t.error) setMsg("Erro equipe: " + t.error.message);
    setTecs((t.data ?? []) as unknown as Tec[]);
  }

  async function carregarDocs() {
    const pid = Number(pessoaId);
    if (!pid) {
      setDocs([]);
      return;
    }

    const { data, error } = await supabase
      .from("documentos")
      .select("id, tipo_pessoa, pessoa_id, tipo_documento, arquivo_url, status, observacao")
      .eq("tipo_pessoa", aba)
      .eq("pessoa_id", pid)
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro docs: " + error.message);
    setDocs((data ?? []) as unknown as Documento[]);
  }

  async function enviarArquivo(file: File) {
    setMsg("");
    if (!perfil) return;

    const pid = Number(pessoaId);
    if (!pid) return setMsg("Selecione a pessoa.");

    // caminho do arquivo
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const path = `${perfil.municipio_id}/${perfil.escola_id}/${aba}/${pid}/${tipoDoc}/${fileName}`;

    setMsg("Enviando arquivo...");

    const up = await supabase.storage.from("jers-docs").upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (up.error) return setMsg("Erro upload: " + up.error.message);

    const { data: pub } = supabase.storage.from("jers-docs").getPublicUrl(path);
    const url = pub.publicUrl;

    // se já existe doc do mesmo tipo pra essa pessoa, atualiza; senão, cria
    const existente = docs.find((d) => d.tipo_documento === tipoDoc);

    if (existente) {
      const { error } = await supabase
        .from("documentos")
        .update({ arquivo_url: url, status: "PENDENTE", observacao: null })
        .eq("id", existente.id);

      if (error) return setMsg("Erro ao atualizar registro: " + error.message);
    } else {
      const { error } = await supabase.from("documentos").insert({
        tipo_pessoa: aba,
        pessoa_id: pid,
        tipo_documento: tipoDoc,
        arquivo_url: url,
        status: "PENDENTE",
      });

      if (error) return setMsg("Erro ao salvar registro: " + error.message);
    }

    setMsg("Enviado ✅ (ficou PENDENTE para aprovação)");
    await carregarDocs();
  }

  const pessoasOptions = useMemo(() => {
    return aba === "ATLETA"
      ? atletas.map((p) => ({ id: p.id, label: p.nome }))
      : tecs.map((p) => ({ id: p.id, label: `${p.nome} (${p.funcao})` }));
  }, [aba, atletas, tecs]);

  useEffect(() => {
    (async () => {
      await carregarPerfil();
    })();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    carregarPessoas(perfil.escola_id);
  }, [perfil]);

  useEffect(() => {
    setPessoaId("");
    setDocs([]);
  }, [aba]);

  useEffect(() => {
    carregarDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoaId, aba]);

  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestor • Documentos</h1>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button onClick={() => setAba("ATLETA")} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Atletas
        </button>
        <button onClick={() => setAba("EQUIPE_TECNICA")} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Equipe técnica
        </button>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, maxWidth: 520 }}>
        <select
          value={pessoaId}
          onChange={(e) => setPessoaId(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="">Selecione...</option>
          {pessoasOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={tipoDoc}
          onChange={(e) => setTipoDoc(e.target.value as any)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          disabled={!pessoaId}
        >
          {TIPOS_DOC.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          type="file"
          disabled={!pessoaId}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviarArquivo(f);
            e.currentTarget.value = ""; // permite reenviar mesmo arquivo
          }}
        />

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 20, fontSize: 18, fontWeight: 700 }}>Documentos enviados</h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 10 }}>
        {docs.map((d) => (
          <div
            key={d.id}
            style={{
              padding: 12,
              borderBottom: "1px solid #eee",
              display: "grid",
              gridTemplateColumns: "160px 120px 1fr",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 700 }}>{d.tipo_documento}</div>
            <div>{d.status}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <a href={d.arquivo_url} target="_blank" rel="noreferrer">
                Abrir arquivo
              </a>
              {d.observacao ? <span style={{ fontSize: 12, opacity: 0.85 }}>Obs: {d.observacao}</span> : null}
            </div>
          </div>
        ))}
        {docs.length === 0 && <div style={{ padding: 12 }}>Nenhum documento ainda.</div>}
      </div>
    </main>
  );
}
