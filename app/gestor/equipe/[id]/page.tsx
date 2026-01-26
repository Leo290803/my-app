"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const FUNCOES = ["CHEFE_DE_DELEGACAO", "TECNICO", "AUXILIAR", "OFICIAL"] as const;
type Funcao = (typeof FUNCOES)[number];

type Equipe = {
  id: number;
  nome: string;
  cpf: string | null;
  funcao: Funcao;
  status_doc: "PENDENTE" | "CONCLUIDO";
  ativo: boolean;

  email: string | null;
  telefone: string | null;
  rg: string | null;
  orgao_expedidor: string | null;
  data_nascimento: string | null;
  cref: string | null;
};

export default function EditarEquipeTecnicaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const equipeId = Number(params.id);

  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [form, setForm] = useState<Equipe | null>(null);

  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("equipe_tecnica")
        .select(
          "id,nome,cpf,funcao,status_doc,ativo,email,telefone,rg,orgao_expedidor,data_nascimento,cref"
        )
        .eq("id", equipeId)
        .maybeSingle();

      if (error) return setMsg("Erro ao carregar: " + error.message);
      if (!data) return setMsg("Registro não encontrado.");

      setForm(data as Equipe);
    })();
  }, [equipeId]);

  function set<K extends keyof Equipe>(key: K, value: Equipe[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function salvar() {
    if (!form) return;
    setMsg("");

    if (!form.nome.trim()) return setMsg("Nome é obrigatório.");

    setSalvando(true);

    const payload = {
      nome: form.nome.trim(),
      cpf: onlyDigits(form.cpf ?? "") || null,
      funcao: form.funcao,
      status_doc: form.status_doc,

      email: (form.email ?? "").trim() || null,
      telefone: onlyDigits(form.telefone ?? "") || null,
      rg: (form.rg ?? "").trim() || null,
      orgao_expedidor: (form.orgao_expedidor ?? "").trim() || null,
      data_nascimento: form.data_nascimento || null,
      cref: (form.cref ?? "").trim() || null,
    };

    const { error } = await supabase.from("equipe_tecnica").update(payload).eq("id", equipeId);

    setSalvando(false);
    if (error) return setMsg("Erro ao salvar: " + error.message);

    router.push("/gestor/equipe");
  }

  async function excluir() {
    if (!form) return;

    const ok = window.confirm(
      `Tem certeza que deseja excluir (desativar) "${form.nome}"?\n\nIsso vai marcar como INATIVO (não apaga do sistema).`
    );
    if (!ok) return;

    setMsg("");
    setExcluindo(true);

    const { error } = await supabase
      .from("equipe_tecnica")
      .update({ ativo: false })
      .eq("id", equipeId);

    setExcluindo(false);

    if (error) return setMsg("Erro ao excluir: " + error.message);

    router.push("/gestor/equipe");
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <PageHeader title="Editar equipe técnica" subtitle="Carregando..." />
        {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar equipe técnica"
        subtitle={`ID: ${form.id}`}
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
          <div className="text-sm text-zinc-600">Edite e salve</div>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Função">
            <select
              value={form.funcao}
              onChange={(e) => set("funcao", e.target.value as Funcao)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              {FUNCOES.map((f) => (
                <option key={f} value={f}>
                  {f.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status doc">
            <select
              value={form.status_doc}
              onChange={(e) => set("status_doc", e.target.value as "PENDENTE" | "CONCLUIDO")}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              <option value="PENDENTE">PENDENTE</option>
              <option value="CONCLUIDO">CONCLUIDO</option>
            </select>
          </Field>

          <Field label="CPF">
            <input
              value={form.cpf ?? ""}
              onChange={(e) => set("cpf", e.target.value)}
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

          <Field label="Data de nascimento">
            <input
              type="date"
              value={form.data_nascimento ?? ""}
              onChange={(e) => set("data_nascimento", e.target.value)}
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
              {excluindo ? "Excluindo..." : "Excluir (desativar)"}
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