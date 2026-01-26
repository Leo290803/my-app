"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number };

type Atleta = {
  id: number;
  nome: string;
  ativo: boolean;
};

type Pendencia = {
  id: number;
  participante_tipo: "ATLETA";
  participante_id: number;
  escola_id: number;

  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;

  status: "PENDENTE" | "CONCLUIDO";
  observacao: string | null;
};

const BUCKET = "jers-arquivos";

export default function GestorPendenciasPage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);

  const [busca, setBusca] = useState("");

  // map participante_id -> pendencia
  const pendByAtletaId = useMemo(() => {
    const m = new Map<number, Pendencia>();
    pendencias.forEach((p) => m.set(p.participante_id, p));
    return m;
  }, [pendencias]);

  const atletasFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const base = atletas.filter((a) => a.ativo);
    if (!b) return base;
    return base.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, busca]);

  async function carregarPerfil() {
    setMsg("Carregando...");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      setMsg("Sem sessão. Faça login novamente.");
      return;
    }

    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setMsg("Erro perfil: " + error.message);
      return;
    }
    if (!data?.escola_id) {
      setMsg("Perfil sem escola_id.");
      return;
    }
    setPerfil({ escola_id: data.escola_id });
    setMsg("");
  }

  async function carregarAtletas(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, ativo")
      .eq("escola_id", escolaId)
      .order("nome");

    if (error) {
      setMsg("Erro atletas: " + error.message);
      return;
    }
    setAtletas((data ?? []) as any);
  }

  async function carregarPendencias(escolaId: number) {
    const { data, error } = await supabase
      .from("participante_arquivos")
      .select("id, participante_tipo, participante_id, escola_id, foto_url, ficha_url, doc_url, status, observacao")
      .eq("escola_id", escolaId)
      .eq("participante_tipo", "ATLETA");

    if (error) {
      setMsg("Erro pendências: " + error.message);
      return;
    }
    setPendencias((data ?? []) as any);
  }

  async function garantirLinhaPendencia(atletaId: number) {
    if (!perfil?.escola_id) return null;

    const existente = pendByAtletaId.get(atletaId);
    if (existente) return existente;

    // cria linha inicial
    const { data, error } = await supabase
      .from("participante_arquivos")
      .insert({
        participante_tipo: "ATLETA",
        participante_id: atletaId,
        escola_id: perfil.escola_id,
      })
      .select("id, participante_tipo, participante_id, escola_id, foto_url, ficha_url, doc_url, status, observacao")
      .maybeSingle();

    if (error) {
      setMsg("Erro ao criar pendência: " + error.message);
      return null;
    }

    // atualiza estado local
    const nova = data as any as Pendencia;
    setPendencias((prev) => [nova, ...prev]);
    return nova;
  }

  function extFromName(name: string) {
    const parts = name.split(".");
    if (parts.length < 2) return "bin";
    return parts[parts.length - 1].toLowerCase();
  }

  async function uploadArquivo(atletaId: number, campo: "foto_url" | "ficha_url" | "doc_url", file: File) {
    if (!perfil?.escola_id) return;

    setMsg("Enviando arquivo...");
    const linha = await garantirLinhaPendencia(atletaId);
    if (!linha) return;

    const ext = extFromName(file.name);
    const path = `atletas/${perfil.escola_id}/${atletaId}/${campo}-${Date.now()}.${ext}`;

    // upload no storage
    const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (up.error) {
      setMsg("Erro upload: " + up.error.message);
      return;
    }

    // pegar URL pública (MVP bucket public)
    const pub = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub.data.publicUrl;

    // salvar URL na tabela
    const { error: updErr } = await supabase
      .from("participante_arquivos")
      .update({ [campo]: publicUrl })
      .eq("id", linha.id);

    if (updErr) {
      setMsg("Erro ao salvar URL: " + updErr.message);
      return;
    }

    setMsg("Arquivo enviado ✅");
    // recarrega pendências pra refletir status (trigger)
    await carregarPendencias(perfil.escola_id);
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (!perfil?.escola_id) return;
    carregarAtletas(perfil.escola_id);
    carregarPendencias(perfil.escola_id);
  }, [perfil?.escola_id]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gestor • Pendências (Atletas)</h1>

      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
        Você pode inscrever primeiro e anexar <b>Foto</b>, <b>Ficha</b> e <b>Documento</b> depois. O status muda automaticamente para <b>CONCLUIDO</b>.
      </div>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar atleta..."
          style={{ padding: 10, width: "100%", border: "1px solid #ddd", borderRadius: 10 }}
        />
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ padding: 10, fontWeight: 800 }}>Lista</div>

        <div
          style={{
            padding: 10,
            display: "grid",
            gridTemplateColumns: "70px 1.4fr 130px 1fr",
            gap: 10,
            fontWeight: 800,
            borderTop: "1px solid #eee",
            fontSize: 13,
          }}
        >
          <span>ID</span>
          <span>Atleta</span>
          <span>Status</span>
          <span>Anexos</span>
        </div>

        {atletasFiltrados.slice(0, 300).map((a) => {
          const p = pendByAtletaId.get(a.id);
          const status = p?.status ?? "PENDENTE";

          const temFoto = !!p?.foto_url;
          const temFicha = !!p?.ficha_url;
          const temDoc = !!p?.doc_url;

          return (
            <div
              key={a.id}
              style={{
                padding: 10,
                display: "grid",
                gridTemplateColumns: "70px 1.4fr 130px 1fr",
                gap: 10,
                borderTop: "1px solid #eee",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <span>#{a.id}</span>

              <div>
                <div style={{ fontWeight: 700 }}>{a.nome}</div>
                {p?.observacao ? (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                    Observação ADM: <b>{p.observacao}</b>
                  </div>
                ) : null}
              </div>

              <span style={{ fontWeight: 800 }}>{status}</span>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadArquivo(a.id, "foto_url", f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}>
                    {temFoto ? "✅ Foto" : "📸 Foto"}
                  </span>
                </label>

                <label style={{ cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadArquivo(a.id, "ficha_url", f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}>
                    {temFicha ? "✅ Ficha" : "📄 Ficha"}
                  </span>
                </label>

                <label style={{ cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadArquivo(a.id, "doc_url", f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}>
                    {temDoc ? "✅ Doc" : "🪪 Doc"}
                  </span>
                </label>

                {/* Links rápidos */}
                <div style={{ display: "flex", gap: 10 }}>
                  {p?.foto_url ? (
                    <a href={p.foto_url} target="_blank" rel="noreferrer">
                      ver foto
                    </a>
                  ) : null}
                  {p?.ficha_url ? (
                    <a href={p.ficha_url} target="_blank" rel="noreferrer">
                      ver ficha
                    </a>
                  ) : null}
                  {p?.doc_url ? (
                    <a href={p.doc_url} target="_blank" rel="noreferrer">
                      ver doc
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {atletasFiltrados.length === 0 && <div style={{ padding: 12, opacity: 0.85 }}>Nenhum atleta.</div>}
      </div>
    </main>
  );
}
