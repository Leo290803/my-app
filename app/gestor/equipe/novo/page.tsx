"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Perfil = {
  escola_id: number | null;
  municipio_id: number | null;
  tipo: "ADMIN" | "GESTOR";
};

const FUNCOES = ["CHEFE_DE_DELEGACAO", "TECNICO", "AUXILIAR", "OFICIAL"] as const;
type Funcao = (typeof FUNCOES)[number];

const onlyDigits = (v: string) => v.replace(/\D/g, "");

type FormEquipe = {
  nome: string;
  funcao: Funcao;
  status_doc: "PENDENTE" | "CONCLUIDO";

  email: string;
  telefone: string;

  cpf: string;
  rg: string;
  orgao_expedidor: string;
  cref: string;

  cep: string;
  pais: string;
  estado: string;
  municipio: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento: string;
};

const initialForm: FormEquipe = {
  nome: "",
  funcao: "TECNICO",
  status_doc: "PENDENTE",

  email: "",
  telefone: "",

  cpf: "",
  rg: "",
  orgao_expedidor: "",
  cref: "",

  cep: "",
  pais: "",
  estado: "",
  municipio: "",
  logradouro: "",
  numero: "",
  bairro: "",
  complemento: "",
};

export default function NovoEquipeTecnicaPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState<FormEquipe>(initialForm);

  async function carregarPerfil() {
    setMsg("");
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id, tipo")
      .maybeSingle();

    if (error) return setMsg("Erro ao carregar perfil: " + error.message);

    if (!data?.escola_id || !data?.municipio_id) {
      return setMsg("Perfil do gestor está sem escola/município. Fale com o Admin.");
    }

    setPerfil(data as Perfil);
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  function set<K extends keyof FormEquipe>(key: K, value: FormEquipe[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvar() {
    setMsg("");
    if (!perfil?.escola_id || !perfil?.municipio_id) return;

    if (!form.nome.trim()) return setMsg("Nome é obrigatório.");

    setSalvando(true);

    const payload = {
      escola_id: perfil.escola_id,
      municipio_id: perfil.municipio_id,

      nome: form.nome.trim(),
      funcao: form.funcao,
      status_doc: form.status_doc,
      ativo: true,

      email: form.email.trim() || null,
      telefone: onlyDigits(form.telefone) || null,

      cpf: onlyDigits(form.cpf) || null,
      rg: form.rg.trim() || null,
      orgao_expedidor: form.orgao_expedidor.trim() || null,
      cref: form.cref.trim() || null,

      cep: onlyDigits(form.cep) || null,
      pais: form.pais.trim() || null,
      estado: form.estado.trim() || null,
      municipio: form.municipio.trim() || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      bairro: form.bairro.trim() || null,
      complemento: form.complemento.trim() || null,
    };

    const { error } = await supabase.from("equipe_tecnica").insert(payload);

    setSalvando(false);

    if (error) return setMsg("Erro ao salvar: " + error.message);

    router.push("/gestor/equipe");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo cadastro • Equipe técnica"
        subtitle="Cadastro completo (inclui CREF)"
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
          <div className="text-sm text-zinc-600">Preencha e salve</div>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo *">
            <input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Função *">
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

          <Field label="Status dos documentos">
            <select
              value={form.status_doc}
              onChange={(e) => set("status_doc", e.target.value as any)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              <option value="PENDENTE">PENDENTE</option>
              <option value="CONCLUIDO">CONCLUIDO</option>
            </select>
          </Field>

          <Field label="CREF">
            <input
              value={form.cref}
              onChange={(e) => set("cref", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Ex: 000000-G/RR"
            />
          </Field>

          <div className="sm:col-span-2 mt-2 font-semibold">Contato</div>

          <Field label="Email">
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Telefone">
            <input
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <div className="sm:col-span-2 mt-2 font-semibold">Documentos</div>

          <Field label="CPF">
            <input
              value={form.cpf}
              onChange={(e) => set("cpf", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="RG">
            <input
              value={form.rg}
              onChange={(e) => set("rg", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Órgão expedidor">
            <input
              value={form.orgao_expedidor}
              onChange={(e) => set("orgao_expedidor", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <div className="sm:col-span-2 mt-2 font-semibold">Endereço</div>

          <Field label="CEP">
            <input
              value={form.cep}
              onChange={(e) => set("cep", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="País">
            <input
              value={form.pais}
              onChange={(e) => set("pais", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Estado (UF)">
            <input
              value={form.estado}
              onChange={(e) => set("estado", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              maxLength={2}
            />
          </Field>

          <Field label="Município">
            <input
              value={form.municipio}
              onChange={(e) => set("municipio", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Logradouro">
            <input
              value={form.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Número">
            <input
              value={form.numero}
              onChange={(e) => set("numero", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Bairro">
            <input
              value={form.bairro}
              onChange={(e) => set("bairro", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Complemento" className="sm:col-span-2">
            <input
              value={form.complemento}
              onChange={(e) => set("complemento", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/gestor/equipe"
              className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
            >
              Cancelar
            </Link>

            <button
              onClick={salvar}
              disabled={salvando || !perfil?.escola_id}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Cadastrar"}
            </button>
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