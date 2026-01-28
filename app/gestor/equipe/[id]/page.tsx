"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Perfil = { escola_id: number; municipio_id: number };

type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";
const PARTICIPANTE_TIPO = "TECNICO";

const BUCKET_ARQUIVOS = "jers-arquivos";
const BUCKET_DOCS = "jers-docs";

const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

async function uploadArquivo(bucket: "ARQUIVOS" | "DOCS", file: File, path: string) {
  const bucketName = bucket === "ARQUIVOS" ? BUCKET_ARQUIVOS : BUCKET_DOCS;

  const { error } = await supabase.storage.from(bucketName).upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data.publicUrl;
}

type EquipeTecnica = {
  id: number;
  escola_id: number;
  municipio_id: number;

  nome: string;
  cpf: string | null;
  rg: string | null;
  funcao: string | null;
  cref: string | null;

  email: string | null;
  telefone: string | null;

  data_nascimento: string | null;
  orgao_expedidor: string | null;

  cep: string | null;
  pais: string | null;
  estado: string | null;
  municipio: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;

  status_doc: DocStatus | null;
  ativo: boolean;

  foto_url?: string | null;
  ficha_url?: string | null;
  identidade_url?: string | null;
};

export default function EditarEquipeTecnicaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const idNum = Number(params.id);

  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [form, setForm] = useState<EquipeTecnica | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // anexos
  const [foto, setFoto] = useState<File | null>(null);
  const [docFrente, setDocFrente] = useState<File | null>(null);
  const [docVerso, setDocVerso] = useState<File | null>(null);

  const [arqId, setArqId] = useState<number | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docFrenteUrl, setDocFrenteUrl] = useState<string | null>(null);
  const [docVersoUrl, setDocVersoUrl] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<DocStatus>("PENDENTE");
  const [salvandoAnexos, setSalvandoAnexos] = useState(false);

  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("perfis")
        .select("escola_id, municipio_id")
        .maybeSingle();

      if (error) return setMsg("Erro ao carregar perfil: " + error.message);
      if (!data?.escola_id) return setMsg("Seu perfil está sem escola.");
      setPerfil(data as Perfil);
    })();
  }, []);

  useEffect(() => {
    if (!perfil?.escola_id) return;
    if (!idNum || Number.isNaN(idNum)) return setMsg("ID inválido na URL.");
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.escola_id, idNum]);

  async function carregar() {
    if (!perfil?.escola_id) return;
    setCarregando(true);
    setMsg("");

    const { data, error } = await supabase
      .from("equipe_tecnica")
      .select(
        "id, escola_id, municipio_id, nome, cpf, rg, funcao, cref, email, telefone, data_nascimento, orgao_expedidor, cep, pais, estado, municipio, logradouro, numero, bairro, complemento, status_doc, ativo, foto_url, ficha_url, identidade_url"
      )
      .eq("id", idNum)
      .eq("escola_id", perfil.escola_id)
      .maybeSingle();

    setCarregando(false);

    if (error) return setMsg("Erro ao carregar: " + error.message);
    if (!data?.id) return setMsg("Registro não encontrado.");

    setForm(data as EquipeTecnica);

    // carrega anexos via participante_arquivos
    await carregarArquivos(perfil.escola_id, idNum);
  }

  async function carregarArquivos(escolaId: number, participanteIdNum: number) {
    const { data, error } = await supabase
      .from("participante_arquivos")
      .select("id, status, foto_url, doc_url, ficha_url")
      .eq("escola_id", escolaId)
      .eq("participante_tipo", PARTICIPANTE_TIPO)
      .eq("participante_id", participanteIdNum)
      .maybeSingle();

    if (error) return;

    if (data?.id) {
      setArqId(data.id);
      setDocStatus((data.status ?? "PENDENTE") as DocStatus);
      setFotoUrl(data.foto_url ?? null);
      setDocFrenteUrl(data.doc_url ?? null);
      setDocVersoUrl(data.ficha_url ?? null);
    } else {
      // se não existir ainda, pega do espelho da tabela (se tiver)
      setFotoUrl(form?.foto_url ?? null);
      setDocFrenteUrl(form?.identidade_url ?? null);
      setDocVersoUrl(form?.ficha_url ?? null);
      setDocStatus((form?.status_doc ?? "PENDENTE") as DocStatus);
    }
  }

  function set<K extends keyof EquipeTecnica>(key: K, value: EquipeTecnica[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function salvar() {
    if (!perfil?.escola_id) return;
    if (!form?.id) return;

    const nome = form.nome.trim();
    if (!nome) return setMsg("Nome é obrigatório.");

    const cpfLimpo = onlyDigits(form.cpf ?? "");
    if (cpfLimpo && cpfLimpo.length !== 11) return setMsg("CPF inválido (precisa ter 11 dígitos).");

    setSalvando(true);
    setMsg("");

    const payload: any = {
      nome,
      cpf: cpfLimpo || null,
      rg: (form.rg ?? "").trim() || null,
      funcao: (form.funcao ?? "").trim() || null,
      cref: (form.cref ?? "").trim() || null,
      email: (form.email ?? "").trim() || null,
      telefone: onlyDigits(form.telefone ?? "") || null,

      data_nascimento: form.data_nascimento || null,
      orgao_expedidor: (form.orgao_expedidor ?? "").trim() || null,

      cep: onlyDigits(form.cep ?? "") || null,
      pais: (form.pais ?? "").trim() || null,
      estado: (form.estado ?? "").trim() || null,
      municipio: (form.municipio ?? "").trim() || null,
      logradouro: (form.logradouro ?? "").trim() || null,
      numero: (form.numero ?? "").trim() || null,
      bairro: (form.bairro ?? "").trim() || null,
      complemento: (form.complemento ?? "").trim() || null,
    };

    const { data, error } = await supabase
      .from("equipe_tecnica")
      .update(payload)
      .eq("id", form.id)
      .eq("escola_id", perfil.escola_id)
      .select("id")
      .maybeSingle();

    setSalvando(false);

    if (error) return setMsg("Erro ao salvar: " + error.message);
    if (!data?.id) return setMsg("Nada foi atualizado. Verifique permissões (RLS).");

    setMsg("Atualizado ✅");
    await carregar();
  }

  async function salvarAnexos() {
    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");
    if (!idNum) return;
    setMsg("");

    if (!foto && !docFrente && !docVerso) {
      return setMsg("Selecione pelo menos um arquivo para enviar.");
    }

    setSalvandoAnexos(true);

    try {
      let rowId = arqId;

      if (!rowId) {
        const { data, error } = await supabase
          .from("participante_arquivos")
          .insert({
            participante_tipo: PARTICIPANTE_TIPO,
            participante_id: idNum,
            escola_id: perfil.escola_id,
            status: "PENDENTE",
          })
          .select("id")
          .maybeSingle();

        if (error) throw error;
        rowId = data?.id ?? null;
        setArqId(rowId);
      }

      if (!rowId) throw new Error("Não foi possível criar registro de arquivos.");

      const folder = `pendencias/${perfil.escola_id}/tecnico/${idNum}`;
      const patch: any = {};

      let nextFotoUrl = fotoUrl;
      let nextFrenteUrl = docFrenteUrl;
      let nextVersoUrl = docVersoUrl;

      if (foto) {
        const path = `${folder}/foto-${Date.now()}-${foto.name}`.replace(/\s+/g, "_");
        nextFotoUrl = await uploadArquivo("ARQUIVOS", foto, path);
        patch.foto_url = nextFotoUrl;
      }

      if (docFrente) {
        const path = `${folder}/identidade-frente-${Date.now()}-${docFrente.name}`.replace(/\s+/g, "_");
        nextFrenteUrl = await uploadArquivo("DOCS", docFrente, path);
        patch.doc_url = nextFrenteUrl;
      }

      if (docVerso) {
        const path = `${folder}/identidade-verso-${Date.now()}-${docVerso.name}`.replace(/\s+/g, "_");
        nextVersoUrl = await uploadArquivo("DOCS", docVerso, path);
        patch.ficha_url = nextVersoUrl;
      }

      const completo = !!(nextFotoUrl && nextFrenteUrl && nextVersoUrl);
      patch.status = completo ? "CONCLUIDO" : "PENDENTE";

      const { error: uErr } = await supabase.from("participante_arquivos").update(patch).eq("id", rowId);
      if (uErr) throw uErr;

      // espelha na equipe_tecnica
      const patchEquipe: any = { status_doc: patch.status };
      if (patch.foto_url) patchEquipe.foto_url = patch.foto_url;
      if (patch.doc_url) patchEquipe.identidade_url = patch.doc_url;
      if (patch.ficha_url) patchEquipe.ficha_url = patch.ficha_url;

      await supabase.from("equipe_tecnica").update(patchEquipe).eq("id", idNum);

      if (patch.foto_url) setFotoUrl(patch.foto_url);
      if (patch.doc_url) setDocFrenteUrl(patch.doc_url);
      if (patch.ficha_url) setDocVersoUrl(patch.ficha_url);
      setDocStatus(patch.status as DocStatus);

      setFoto(null);
      setDocFrente(null);
      setDocVerso(null);

      setMsg(completo ? "Anexos enviados ✅ (status: CONCLUIDO)" : "Anexos enviados ✅ (faltam anexos)");
    } catch (e: any) {
      setMsg("Erro ao enviar anexos: " + (e?.message ?? String(e)));
    }

    setSalvandoAnexos(false);
  }

  async function desativar() {
    if (!perfil?.escola_id) return;
    if (!form?.id) return;

    const ok = window.confirm(
      `Tem certeza que deseja desativar "${form.nome}"?\n\nIsso não apaga do sistema.`
    );
    if (!ok) return;

    setExcluindo(true);
    setMsg("");

    const { error } = await supabase
      .from("equipe_tecnica")
      .update({ ativo: false })
      .eq("id", form.id)
      .eq("escola_id", perfil.escola_id);

    setExcluindo(false);

    if (error) return setMsg("Erro ao desativar: " + error.message);

    router.push("/gestor/equipe");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar cadastro"
        subtitle={form?.id ? `ID: ${form.id}` : "Carregando..."}
        right={
          <Link
            href="/gestor/equipe"
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
          >
            Voltar
          </Link>
        }
      />

      {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Dados</div>
          <div className="text-sm text-zinc-600">Edite e salve as informações</div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {carregando ? (
            <div className="py-6 text-sm opacity-70">Carregando...</div>
          ) : !form ? (
            <div className="py-6 text-sm opacity-70">Nada para editar.</div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome *" className="sm:col-span-2">
                  <input
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="CPF">
                  <input
                    value={form.cpf ?? ""}
                    onChange={(e) => set("cpf", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                    placeholder="Somente números"
                  />
                </Field>

                <Field label="RG">
                  <input
                    value={form.rg ?? ""}
                    onChange={(e) => set("rg", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Função">
                  <input
                    value={form.funcao ?? ""}
                    onChange={(e) => set("funcao", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="CREF">
                  <input
                    value={form.cref ?? ""}
                    onChange={(e) => set("cref", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Email">
                  <input
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Telefone">
                  <input
                    value={form.telefone ?? ""}
                    onChange={(e) => set("telefone", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Data de nascimento">
                  <input
                    type="date"
                    value={form.data_nascimento ?? ""}
                    onChange={(e) => set("data_nascimento", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Órgão expedidor">
                  <input
                    value={form.orgao_expedidor ?? ""}
                    onChange={(e) => set("orgao_expedidor", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>
              </div>

              <div className="mt-2 font-semibold">Endereço</div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CEP">
                  <input
                    value={form.cep ?? ""}
                    onChange={(e) => set("cep", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="País">
                  <input
                    value={form.pais ?? ""}
                    onChange={(e) => set("pais", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Estado (UF)">
                  <input
                    value={form.estado ?? ""}
                    onChange={(e) => set("estado", e.target.value)}
                    maxLength={2}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Município">
                  <input
                    value={form.municipio ?? ""}
                    onChange={(e) => set("municipio", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Logradouro" className="sm:col-span-2">
                  <input
                    value={form.logradouro ?? ""}
                    onChange={(e) => set("logradouro", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Número">
                  <input
                    value={form.numero ?? ""}
                    onChange={(e) => set("numero", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Bairro">
                  <input
                    value={form.bairro ?? ""}
                    onChange={(e) => set("bairro", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>

                <Field label="Complemento" className="sm:col-span-2">
                  <input
                    value={form.complemento ?? ""}
                    onChange={(e) => set("complemento", e.target.value)}
                    className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
                  />
                </Field>
              </div>

              {/* ANEXOS */}
              <div className="mt-2">
                <Card>
                  <CardHeader>
                    <div className="font-semibold">Documentos / Anexos</div>
                    <div className="text-sm text-zinc-600">
                      Status atual: <b>{docStatus}</b>. Ao anexar os 3 arquivos fica <b>CONCLUIDO</b>.
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-1">
                      <div className="text-sm font-medium">Foto</div>
                      {fotoUrl ? (
                        <a className="text-sm text-blue-700 underline" href={fotoUrl} target="_blank" rel="noreferrer">
                          Ver atual
                        </a>
                      ) : (
                        <div className="text-xs opacity-70">Sem arquivo</div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
                    </div>

                    <div className="grid gap-1">
                      <div className="text-sm font-medium">Identidade (frente)</div>
                      {docFrenteUrl ? (
                        <a className="text-sm text-blue-700 underline" href={docFrenteUrl} target="_blank" rel="noreferrer">
                          Ver atual
                        </a>
                      ) : (
                        <div className="text-xs opacity-70">Sem arquivo</div>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setDocFrente(e.target.files?.[0] ?? null)}
                      />
                    </div>

                    <div className="grid gap-1">
                      <div className="text-sm font-medium">Identidade (verso)</div>
                      {docVersoUrl ? (
                        <a className="text-sm text-blue-700 underline" href={docVersoUrl} target="_blank" rel="noreferrer">
                          Ver atual
                        </a>
                      ) : (
                        <div className="text-xs opacity-70">Sem arquivo</div>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setDocVerso(e.target.files?.[0] ?? null)}
                      />
                    </div>

                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        onClick={salvarAnexos}
                        disabled={salvandoAnexos}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        {salvandoAnexos ? "Enviando..." : "Salvar anexos"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* BOTÕES */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={desativar}
                  disabled={excluindo || salvando}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {excluindo ? "Desativando..." : "Excluir (desativar)"}
                </button>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href="/gestor/equipe"
                    className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
                  >
                    Cancelar
                  </Link>

                  <button
                    onClick={salvar}
                    disabled={salvando || excluindo}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {salvando ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}