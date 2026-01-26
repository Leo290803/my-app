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

export default function EditarAtletaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const atletaId = Number(params.id);

  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [form, setForm] = useState<Atleta | null>(null);

  useEffect(() => {
    (async () => {
      setMsg("");
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
    })();
  }, [atletaId]);

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

  async function excluir() {
    if (!form) return;

    const ok = window.confirm(
      `Tem certeza que deseja excluir (desativar) o atleta "${form.nome}"?\n\nIsso vai marcar como INATIVO (não apaga do sistema).`
    );
    if (!ok) return;

    setMsg("");
    setExcluindo(true);

    const { error } = await supabase
      .from("atletas")
      .update({ ativo: false })
      .eq("id", atletaId);

    setExcluindo(false);

    if (error) return setMsg("Erro ao excluir: " + error.message);

    router.push("/gestor/atletas");
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <PageHeader title="Editar atleta" subtitle="Carregando..." />
        {msg ? (
          <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div>
        ) : null}
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