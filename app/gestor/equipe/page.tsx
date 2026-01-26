"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Perfil = {
  escola_id: number | null;
  municipio_id: number | null;
  tipo: "ADMIN" | "GESTOR";
};

type Equipe = {
  id: number;
  nome: string;
  cpf: string | null;
  funcao: string;
  status_doc: "PENDENTE" | "CONCLUIDO";
  ativo: boolean;
};

const PAGE_SIZE = 15;

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export default function GestorEquipeListaPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<Equipe[]>([]);
  const [msg, setMsg] = useState("");

  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);

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

  async function carregarEquipe(escolaId: number) {
    setMsg("");

    const { data, error } = await supabase
      .from("equipe_tecnica")
      .select("id,nome,cpf,funcao,status_doc,ativo")
      .eq("escola_id", escolaId)
      .eq("ativo", true) // ✅ só ativos
      .order("nome");

    if (error) return setMsg("Erro ao carregar equipe: " + error.message);
    setLista((data ?? []) as unknown as Equipe[]);
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (perfil?.escola_id) carregarEquipe(perfil.escola_id);
  }, [perfil?.escola_id]);

  // ✅ filtro local (rápido e simples)
  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;

    return lista.filter((p) => {
      const nome = (p.nome ?? "").toLowerCase();
      const cpf = onlyDigits(p.cpf ?? "");
      const funcao = (p.funcao ?? "").toLowerCase();
      return (
        nome.includes(q) ||
        funcao.includes(q) ||
        cpf.includes(onlyDigits(q))
      );
    });
  }, [lista, busca]);

  // ✅ paginação local
  const totalPages = Math.max(1, Math.ceil(filtrada.length / PAGE_SIZE));

  useEffect(() => {
    // se mudar a busca e a página ficar fora do limite, volta pra 1
    setPage(1);
  }, [busca]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtrada.slice(start, start + PAGE_SIZE);
  }, [filtrada, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestor • Equipe Técnica / Oficiais"
        subtitle="Gerencie cadastros, edite, pesquise e exclua (desative)."
        right={
          <Link
            href="/gestor/equipe/novo"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
          >
            + Adicionar membro
          </Link>
        }
      />

      {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Lista</div>
          <div className="text-sm text-zinc-600">
            Mostrando apenas ativos • {filtrada.length} registros
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por nome, função ou CPF…"
              className="h-11 w-full rounded-xl border bg-white px-3 outline-none focus:ring-2 sm:max-w-md"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                ←
              </button>

              <div className="text-sm">
                Página <b>{page}</b> de <b>{totalPages}</b>
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                →
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="hidden grid-cols-12 gap-3 border-b bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600 sm:grid">
              <div className="col-span-5">Nome</div>
              <div className="col-span-3">Função</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            {pageItems.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-1 gap-2 border-b px-4 py-3 sm:grid-cols-12 sm:items-center sm:gap-3"
              >
                <div className="sm:col-span-5">
                  <div className="font-semibold">{p.nome}</div>
                  <div className="text-xs text-zinc-600">CPF: {p.cpf ?? "—"}</div>
                </div>

                <div className="sm:col-span-3 text-sm">
                  {p.funcao.replaceAll("_", " ")}
                </div>

                <div className="sm:col-span-2">
                  <span
                    className={
                      "inline-flex rounded-full px-2 py-1 text-xs font-semibold " +
                      (p.status_doc === "CONCLUIDO"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700")
                    }
                  >
                    {p.status_doc}
                  </span>
                </div>

                <div className="sm:col-span-2 sm:text-right">
                  <Link
                    href={`/gestor/equipe/${p.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-zinc-50"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}

            {pageItems.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-600">
                Nenhum registro encontrado.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}