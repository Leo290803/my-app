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

const FUNCOES = [
  "CHEFE_DE_DELEGACAO",
  "TECNICO",
  "AUXILIAR",
  "OFICIAL",
] as const;

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export default function NovaPessoaEquipePage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [funcao, setFuncao] = useState<(typeof FUNCOES)[number]>("TECNICO");

  async function carregarPerfil() {
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

  async function salvar() {
    setMsg("");
    if (!perfil) return;

    if (!nome.trim()) return setMsg("Informe o nome.");

    setSalvando(true);

    const { error } = await supabase.from("equipe_tecnica").insert({
      escola_id: perfil.escola_id,
      municipio_id: perfil.municipio_id,
      nome: nome.trim(),
      cpf: onlyDigits(cpf) || null,
      funcao,
      status_doc: "PENDENTE",
      ativo: true,
    });

    setSalvando(false);

    if (error) return setMsg("Erro ao salvar: " + error.message);

    router.push("/gestor/equipe");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adicionar membro da equipe"
        subtitle="Cadastre separado da lista (igual atletas)."
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
          <div className="font-semibold">Cadastro</div>
          <div className="text-sm text-zinc-600">Preencha e salve</div>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Nome *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">CPF (opcional)</span>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Função</span>
            <select
              value={funcao}
              onChange={(e) => setFuncao(e.target.value as any)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              {FUNCOES.map((f) => (
                <option key={f} value={f}>
                  {f.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/gestor/equipe"
              className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
            >
              Cancelar
            </Link>

            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}