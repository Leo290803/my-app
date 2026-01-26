"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const FUNCOES = [
  "CHEFE_DE_DELEGACAO",
  "TECNICO",
  "AUXILIAR",
  "OFICIAL",
] as const;

const onlyDigits = (v: string) => v.replace(/\D/g, "");

type Equipe = {
  id: number;
  nome: string;
  cpf: string | null;
  funcao: (typeof FUNCOES)[number] | string;
  status_doc: "PENDENTE" | "CONCLUIDO";
  ativo: boolean;
};

export default function EditarEquipePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const membroId = Number(params.id);

  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [form, setForm] = useState<Equipe | null>(null);

  useEffect(() => {
    (async () => {
      setMsg("");

      const { data, error } = await supabase
        .from("equipe_tecnica")
        .select("id,nome,cpf,funcao,status_doc,ativo")
        .eq("id", membroId)
        .maybeSingle();

      if (error) return setMsg("Erro ao carregar: " + error.message);
      if (!data) return setMsg("Registro não encontrado.");

      setForm(data as Equipe);
    })();
  }, [membroId]);

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
    };

    const { error } = await supabase
      .from("equipe_tecnica")
      .update(payload)
      .eq("id", membroId);

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
      .eq("id", membroId);

    setExcluindo(false);

    if (error) return setMsg("Erro ao excluir: " + error.message);

    router.push("/gestor/equipe");
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <PageHeader title="Editar membro" subtitle="Carregando..." />
        {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar • Equipe"
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
          <Field label="Nome *" className="sm:col-span-2">
            <input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="CPF (opcional)">
            <input
              value={form.cpf ?? ""}
              onChange={(e) => set("cpf", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Função">
            <select
              value={form.funcao}
              onChange={(e) => set("funcao", e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              {FUNCOES.map((f) => (
                <option key={f} value={f}>
                  {f.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status documental">
            <select
              value={form.status_doc}
              onChange={(e) => set("status_doc", e.target.value as any)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              <option value="PENDENTE">PENDENTE</option>
              <option value="CONCLUIDO">CONCLUIDO</option>
            </select>
          </Field>

          {/* Botões */}
          <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={excluir}
              disabled={excluindo || salvando}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
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