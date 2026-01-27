"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const onlyDigits = (v: string) => v.replace(/\D/g, "");

type Atleta = {
  id: number;
  nome: string;
  sexo: "M" | "F";
  data_nascimento: string;

  email: string | null;
  telefone: string | null;

  cpf: string | null;
  rg: string | null;
  orgao_expedidor: string | null;

  cep: string | null;
  pais: string | null;
  estado: string | null;
  municipio: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;

  nome_mae: string | null;
  cpf_mae: string | null;
  telefone_mae: string | null;
  nome_pai: string | null;
  cpf_pai: string | null;
  telefone_pai: string | null;

  ativo?: boolean;
};

type Perfil = { escola_id: number; municipio_id: number };
type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";

// ✅ ajuste se seus buckets tiverem outros nomes
const BUCKET_ARQUIVOS = "jers-arquivos";
const BUCKET_DOCS = "jers-docs";

async function uploadArquivo(bucket: "ARQUIVOS" | "DOCS", file: File, path: string) {
  const bucketName = bucket === "ARQUIVOS" ? BUCKET_ARQUIVOS : BUCKET_DOCS;

  const { error } = await supabase.storage.from(bucketName).upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data.publicUrl;
}

export default function EditarAtletaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const atletaId = Number(params.id);

  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [form, setForm] = useState<Atleta | null>(null);

  // -------- anexos --------
  const [fotoAtleta, setFotoAtleta] = useState<File | null>(null);
  const [idFrente, setIdFrente] = useState<File | null>(null);
  const [idVerso, setIdVerso] = useState<File | null>(null);

  const [arqId, setArqId] = useState<number | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docFrenteUrl, setDocFrenteUrl] = useState<string | null>(null);
  const [docVersoUrl, setDocVersoUrl] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<DocStatus>("PENDENTE");
  const [salvandoAnexos, setSalvandoAnexos] = useState(false);

  useEffect(() => {
    (async () => {
      setMsg("");

      // perfil (pra saber escola_id)
      const { data: p, error: pErr } = await supabase
        .from("perfis")
        .select("escola_id, municipio_id")
        .maybeSingle();

      if (pErr) return setMsg("Erro ao carregar perfil: " + pErr.message);
      if (!p?.escola_id) return setMsg("Seu perfil está sem escola.");
      setPerfil(p as Perfil);

      // atleta
      const { data, error } = await supabase
        .from("atletas")
        .select(
          "id,nome,sexo,data_nascimento,email,telefone,cpf,rg,orgao_expedidor,cep,pais,estado,municipio,logradouro,numero,bairro,complemento,nome_mae,cpf_mae,telefone_mae,nome_pai,cpf_pai,telefone_pai,ativo"
        )
        .eq("id", atletaId)
        .maybeSingle();

      if (error) return setMsg("Erro ao carregar atleta: " + error.message);
      if (!data) return setMsg("Atleta não encontrado.");
      setForm(data as Atleta);

      // arquivos já enviados (se existirem)
      await carregarArquivos(p.escola_id, atletaId);
    })();
  }, [atletaId]);

  async function carregarArquivos(escolaId: number, atletaIdNum: number) {
    const { data, error } = await supabase
      .from("participante_arquivos")
      .select("id, status, foto_url, doc_url, ficha_url")
      .eq("escola_id", escolaId)
      .eq("participante_tipo", "ATLETA")
      .eq("participante_id", atletaIdNum)
      .maybeSingle();

    if (error) return;

    if (data?.id) {
      setArqId(data.id);
      setDocStatus((data.status ?? "PENDENTE") as DocStatus);
      setFotoUrl(data.foto_url ?? null);
      setDocFrenteUrl(data.doc_url ?? null); // frente
      setDocVersoUrl(data.ficha_url ?? null); // verso
    }
  }

  function set<K extends keyof Atleta>(key: K, value: Atleta[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function salvar() {
    if (!form) return;
    setMsg("");

    if (!form.nome.trim()) return setMsg("Nome é obrigatório.");
    if (!form.data_nascimento) return setMsg("Data de nascimento é obrigatória.");

    setSalvando(true);

    const payload = {
      nome: form.nome.trim(),
      sexo: form.sexo,
      data_nascimento: form.data_nascimento,

      email: (form.email ?? "").trim() || null,
      telefone: onlyDigits(form.telefone ?? "") || null,

      cpf: onlyDigits(form.cpf ?? "") || null,
      rg: (form.rg ?? "").trim() || null,
      orgao_expedidor: (form.orgao_expedidor ?? "").trim() || null,

      cep: onlyDigits(form.cep ?? "") || null,
      pais: (form.pais ?? "").trim() || null,
      estado: (form.estado ?? "").trim() || null,
      municipio: (form.municipio ?? "").trim() || null,
      logradouro: (form.logradouro ?? "").trim() || null,
      numero: (form.numero ?? "").trim() || null,
      bairro: (form.bairro ?? "").trim() || null,
      complemento: (form.complemento ?? "").trim() || null,

      nome_mae: (form.nome_mae ?? "").trim() || null,
      cpf_mae: onlyDigits(form.cpf_mae ?? "") || null,
      telefone_mae: onlyDigits(form.telefone_mae ?? "") || null,

      nome_pai: (form.nome_pai ?? "").trim() || null,
      cpf_pai: onlyDigits(form.cpf_pai ?? "") || null,
      telefone_pai: onlyDigits(form.telefone_pai ?? "") || null,
    };

    const { error } = await supabase.from("atletas").update(payload).eq("id", atletaId);

    setSalvando(false);
    if (error) return setMsg("Erro ao salvar: " + error.message);

    router.push("/gestor/atletas");
  }

  async function salvarAnexos() {
    if (!perfil?.escola_id) return setMsg("Perfil sem escola.");
    setMsg("");

    if (!fotoAtleta && !idFrente && !idVerso) {
      return setMsg("Selecione pelo menos um arquivo para enviar.");
    }

    setSalvandoAnexos(true);

    try {
      // garante linha em participante_arquivos
      let rowId = arqId;

      if (!rowId) {
        const { data, error } = await supabase
          .from("participante_arquivos")
          .insert({
            participante_tipo: "ATLETA",
            participante_id: atletaId,
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

      const folder = `pendencias/${perfil.escola_id}/atleta/${atletaId}`;
      const patch: any = {};

      if (fotoAtleta) {
        const path = `${folder}/foto-${Date.now()}-${fotoAtleta.name}`.replace(/\s+/g, "_");
        patch.foto_url = await uploadArquivo("ARQUIVOS", fotoAtleta, path);
      }

      // doc_url = frente, ficha_url = verso (sem mexer no banco)
      if (idFrente) {
        const path = `${folder}/identidade-frente-${Date.now()}-${idFrente.name}`.replace(/\s+/g, "_");
        patch.doc_url = await uploadArquivo("DOCS", idFrente, path);
      }

      if (idVerso) {
        const path = `${folder}/identidade-verso-${Date.now()}-${idVerso.name}`.replace(/\s+/g, "_");
        patch.ficha_url = await uploadArquivo("DOCS", idVerso, path);
      }

      // sempre que enviar/alterar anexos, volta pra pendente
      patch.status = "PENDENTE";

      const { error: uErr } = await supabase.from("participante_arquivos").update(patch).eq("id", rowId);
      if (uErr) throw uErr;

      if (patch.foto_url) setFotoUrl(patch.foto_url);
      if (patch.doc_url) setDocFrenteUrl(patch.doc_url);
      if (patch.ficha_url) setDocVersoUrl(patch.ficha_url);
      setDocStatus("PENDENTE");

      // limpa inputs
      setFotoAtleta(null);
      setIdFrente(null);
      setIdVerso(null);

      setMsg("Anexos enviados ✅ (status voltou para PENDENTE)");
    } catch (e: any) {
      setMsg("Erro ao enviar anexos: " + (e?.message ?? String(e)));
    }

    setSalvandoAnexos(false);
  }

  async function excluir() {
    if (!form) return;

    const ok = window.confirm(
      `Tem certeza que deseja excluir (desativar) o atleta "${form.nome}"?\n\nIsso vai marcar como INATIVO (não apaga do sistema).`
    );
    if (!ok) return;

    setMsg("");
    setExcluindo(true);

    const { error } = await supabase.from("atletas").update({ ativo: false }).eq("id", atletaId);

    setExcluindo(false);

    if (error) return setMsg("Erro ao excluir: " + error.message);

    router.push("/gestor/atletas");
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <PageHeader title="Editar atleta" subtitle="Carregando..." />
        {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar atleta"
        subtitle={`ID: ${form.id}`}
        right={
          <Link
            href="/gestor/atletas"
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
          >
            Voltar
          </Link>
        }
      />

      {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Dados do atleta</div>
          <div className="text-sm text-zinc-600">Edite e salve as informações</div>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo *">
            <input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Sexo">
            <select
              value={form.sexo}
              onChange={(e) => set("sexo", e.target.value as "M" | "F")}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </Field>

          <Field label="Data de nascimento *">
            <input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
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

          <Field label="CPF">
            <input
              value={form.cpf ?? ""}
              onChange={(e) => set("cpf", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="RG">
            <input
              value={form.rg ?? ""}
              onChange={(e) => set("rg", e.target.value)}
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

          <div className="sm:col-span-2 mt-2 font-semibold">Endereço</div>

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
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              maxLength={2}
            />
          </Field>

          <Field label="Município">
            <input
              value={form.municipio ?? ""}
              onChange={(e) => set("municipio", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Logradouro">
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

          <div className="sm:col-span-2 mt-2 font-semibold">Pais / Responsáveis</div>

          <Field label="Nome da mãe" className="sm:col-span-2">
            <input
              value={form.nome_mae ?? ""}
              onChange={(e) => set("nome_mae", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="CPF da mãe">
            <input
              value={form.cpf_mae ?? ""}
              onChange={(e) => set("cpf_mae", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Telefone da mãe">
            <input
              value={form.telefone_mae ?? ""}
              onChange={(e) => set("telefone_mae", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Nome do pai" className="sm:col-span-2">
            <input
              value={form.nome_pai ?? ""}
              onChange={(e) => set("nome_pai", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="CPF do pai">
            <input
              value={form.cpf_pai ?? ""}
              onChange={(e) => set("cpf_pai", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Telefone do pai">
            <input
              value={form.telefone_pai ?? ""}
              onChange={(e) => set("telefone_pai", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          {/* ✅ ANEXOS */}
          <div className="sm:col-span-2">
            <Card>
              <CardHeader>
                <div className="font-semibold">Anexos do atleta</div>
                <div className="text-sm text-zinc-600">
                  Status atual: <b>{docStatus}</b>. Ao enviar novos arquivos, volta para <b>PENDENTE</b>.
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
                  <input type="file" accept="image/*" onChange={(e) => setFotoAtleta(e.target.files?.[0] ?? null)} />
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
                    onChange={(e) => setIdFrente(e.target.files?.[0] ?? null)}
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
                    onChange={(e) => setIdVerso(e.target.files?.[0] ?? null)}
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

          {/* Botões */}
          <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={excluir}
              disabled={excluindo || salvando}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {excluindo ? "Excluindo..." : "Excluir atleta"}
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/gestor/atletas"
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