"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = { escola_id: number; municipio_id: number; ativo?: boolean };

type Participante = {
  id: number;
  tipo: "TECNICO" | "OFICIAL" | "CHEFE" | "GESTOR" | "OUTRO";
  nome: string;
  cpf: string | null;
  funcao: string | null;
  ativo: boolean;
};

type ArquivoRow = {
  id: number;
  participante_tipo: string;
  participante_id: number;
  escola_id: number;
  status: "PENDENTE" | "CONCLUIDO" | "REJEITADO";
  foto_url: string | null;
  ficha_url: string | null;
  doc_url: string | null;
  observacao: string | null;
  observacao_admin: string | null;
};

function slugTipo(tipo: string) {
  return tipo.toLowerCase();
}

async function uploadToBucket(file: File, path: string) {
  const { error } = await supabase.storage.from("public").upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("public").getPublicUrl(path);
  return data.publicUrl;
}

export default function GestorParticipantesPage() {
  const [msg, setMsg] = useState("");

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [lista, setLista] = useState<Participante[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoRow[]>([]);

  // form
  const [tipo, setTipo] = useState<Participante["tipo"]>("TECNICO");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [funcao, setFuncao] = useState("");

  // busca + seleção
  const [busca, setBusca] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);

  const selecionado = useMemo(() => lista.find((x) => x.id === selecionadoId) ?? null, [lista, selecionadoId]);

  const arquivosDoSelecionado = useMemo(() => {
    if (!selecionado || !perfil) return null;
    return (
      arquivos.find(
        (a) =>
          a.participante_tipo === selecionado.tipo &&
          a.participante_id === selecionado.id &&
          a.escola_id === perfil.escola_id
      ) ?? null
    );
  }, [arquivos, selecionado, perfil]);

  async function carregarPerfil() {
    setMsg("");
    const { data: sessionData, error: sErr } = await supabase.auth.getSession();
    if (sErr) return setMsg("Erro sessão: " + sErr.message);

    const userId = sessionData.session?.user?.id;
    if (!userId) return setMsg("Sem sessão. Faça login novamente.");

    const { data, error } = await supabase.from("perfis").select("escola_id, municipio_id, ativo").eq("user_id", userId).maybeSingle();
    if (error) return setMsg("Erro perfil: " + error.message);
    if (!data?.escola_id) return setMsg("Perfil sem escola.");
    if (data.ativo === false) return setMsg("Seu acesso está inativo.");

    setPerfil(data as Perfil);
  }

  async function carregarParticipantes() {
    if (!perfil) return;
    setMsg("");

    const { data, error } = await supabase
      .from("participantes")
      .select("id, tipo, nome, cpf, funcao, ativo")
      .eq("escola_id", perfil.escola_id)
      .eq("ativo", true)
      .order("nome");

    if (error) return setMsg("Erro ao carregar participantes: " + error.message);
    setLista((data ?? []) as any);
  }

  async function carregarArquivos() {
    if (!perfil) return;

    const { data, error } = await supabase
      .from("participante_arquivos")
      .select("id, participante_tipo, participante_id, escola_id, status, foto_url, ficha_url, doc_url, observacao, observacao_admin")
      .eq("escola_id", perfil.escola_id);

    if (error) return setMsg("Erro ao carregar anexos: " + error.message);
    setArquivos((data ?? []) as any);
  }

  async function criar() {
    setMsg("");
    if (!perfil) return setMsg("Sem perfil.");
    if (!nome.trim()) return setMsg("Informe o nome.");

    const { data, error } = await supabase
      .from("participantes")
      .insert({
        escola_id: perfil.escola_id,
        municipio_id: perfil.municipio_id,
        tipo,
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        funcao: funcao.trim() || null,
        ativo: true,
      })
      .select("id, tipo, nome, cpf, funcao, ativo")
      .maybeSingle();

    if (error) return setMsg("Erro ao criar: " + error.message);

    setMsg("Participante criado ✅");
    setNome("");
    setCpf("");
    setFuncao("");

    await carregarParticipantes();
    await carregarArquivos();

    if (data?.id) setSelecionadoId(data.id);
  }

  async function garantirLinhaArquivos(p: Participante) {
    if (!perfil) throw new Error("Sem perfil.");

    const existente = arquivos.find(
      (a) => a.participante_tipo === p.tipo && a.participante_id === p.id && a.escola_id === perfil.escola_id
    );
    if (existente) return existente;

    const { data, error } = await supabase
      .from("participante_arquivos")
      .insert({
        participante_tipo: p.tipo,
        participante_id: p.id,
        escola_id: perfil.escola_id,
        status: "PENDENTE",
      })
      .select("id, participante_tipo, participante_id, escola_id, status, foto_url, ficha_url, doc_url, observacao, observacao_admin")
      .maybeSingle();

    if (error) throw error;

    await carregarArquivos();
    return data as any;
  }

  async function anexar(kind: "foto" | "ficha" | "doc", file: File) {
    setMsg("");
    if (!perfil) return setMsg("Sem perfil.");
    if (!selecionado) return setMsg("Selecione um participante.");

    try {
      const row = await garantirLinhaArquivos(selecionado);

      const folder = `pendencias/${perfil.escola_id}/${slugTipo(selecionado.tipo)}/${selecionado.id}`;
      const filename = `${kind}-${Date.now()}-${file.name}`.replace(/\s+/g, "_");
      const path = `${folder}/${filename}`;

      const publicUrl = await uploadToBucket(file, path);

      const patch: any = {};
      if (kind === "foto") patch.foto_url = publicUrl;
      if (kind === "ficha") patch.ficha_url = publicUrl;
      if (kind === "doc") patch.doc_url = publicUrl;

      const { error } = await supabase.from("participante_arquivos").update(patch).eq("id", row.id);
      if (error) return setMsg("Erro ao salvar anexo: " + error.message);

      setMsg(`${kind.toUpperCase()} anexado ✅`);
      await carregarArquivos();
    } catch (e: any) {
      setMsg("Erro upload: " + (e?.message ?? String(e)));
    }
  }

  const listaFiltrada = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return lista;
    return lista.filter((x) => x.nome.toLowerCase().includes(b) || (x.cpf ?? "").includes(b) || (x.funcao ?? "").toLowerCase().includes(b));
  }, [lista, busca]);

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    carregarParticipantes();
    carregarArquivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.escola_id]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Gestor • Participantes (Técnicos / Oficiais / Chefe)</h1>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Cadastro */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Cadastrar</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Tipo</div>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} style={{ width: "100%", padding: 10 }}>
                <option value="TECNICO">Técnico</option>
                <option value="OFICIAL">Oficial</option>
                <option value="CHEFE">Chefe</option>
                <option value="GESTOR">Gestor</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Nome</div>
              <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: "100%", padding: 10 }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>CPF (opcional)</div>
                <input value={cpf} onChange={(e) => setCpf(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Função (opcional)</div>
                <input value={funcao} onChange={(e) => setFuncao(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </div>
            </div>

            <button onClick={criar} style={{ padding: 10, borderRadius: 10, cursor: "pointer", fontWeight: 800 }}>
              Criar participante
            </button>
          </div>
        </div>

        {/* Lista + anexos */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Lista</div>

          <input
            placeholder="Buscar por nome / cpf / função..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />

          <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
            {listaFiltrada.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelecionadoId(p.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 10,
                  border: "none",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  background: selecionadoId === p.id ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 900 }}>{p.nome}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {p.tipo} {p.funcao ? `• ${p.funcao}` : ""} {p.cpf ? `• CPF ${p.cpf}` : ""}
                </div>
              </button>
            ))}
            {listaFiltrada.length === 0 && <div style={{ padding: 12, opacity: 0.85 }}>Nenhum participante.</div>}
          </div>

          {/* anexos */}
          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontWeight: 900 }}>Anexos</div>
            {!selecionado && <div style={{ padding: 8, opacity: 0.85 }}>Selecione um participante para anexar.</div>}

            {selecionado && (
              <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Selecionado: <b>{selecionado.nome}</b> • <b>{selecionado.tipo}</b>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <label style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, cursor: "pointer" }}>
                    <div style={{ fontWeight: 800 }}>Foto</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {arquivosDoSelecionado?.foto_url ? "✅ anexada" : "— pendente"}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) anexar("foto", f);
                      }}
                    />
                  </label>

                  <label style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, cursor: "pointer" }}>
                    <div style={{ fontWeight: 800 }}>Ficha</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {arquivosDoSelecionado?.ficha_url ? "✅ anexada" : "— pendente"}
                    </div>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) anexar("ficha", f);
                      }}
                    />
                  </label>

                  <label style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, cursor: "pointer" }}>
                    <div style={{ fontWeight: 800 }}>Documento</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {arquivosDoSelecionado?.doc_url ? "✅ anexado" : "— pendente"}
                    </div>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) anexar("doc", f);
                      }}
                    />
                  </label>
                </div>

                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Status: <b>{arquivosDoSelecionado?.status ?? "PENDENTE"}</b>
                  {arquivosDoSelecionado?.observacao_admin ? (
                    <span style={{ marginLeft: 10, opacity: 0.9 }}>Obs admin: {arquivosDoSelecionado.observacao_admin}</span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}