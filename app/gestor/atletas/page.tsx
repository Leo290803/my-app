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

type Atleta = {
  id: number;
  nome: string;
  cpf: string | null;
  data_nascimento: string;
  sexo: "M" | "F";
  status_doc: "PENDENTE" | "CONCLUIDO";
  ativo: boolean;
};

function calcCategoria(dataNascimento: string) {
  const hoje = new Date();
  const dn = new Date(dataNascimento);
  let idade = hoje.getFullYear() - dn.getFullYear();
  const m = hoje.getMonth() - dn.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dn.getDate())) idade--;
  if (idade >= 12 && idade <= 14) return "12–14";
  if (idade >= 15 && idade <= 17) return "15–17";
  return "Fora da faixa";
}

const PAGE_SIZE = 15;

export default function GestorAtletasListaPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<Atleta[]>([]);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  async function carregarPerfil() {
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id, tipo")
      .maybeSingle();

    if (error) return setMsg("Erro ao carregar perfil: " + error.message);
    if (!data?.escola_id) return setMsg("Perfil sem escola. Fale com o Admin.");

    setPerfil(data as Perfil);
  }

async function carregarAtletas(escolaId: number) {
  const { data, error } = await supabase
    .from("atletas")
    .select("id, nome, cpf, data_nascimento, sexo, status_doc, ativo")
    .eq("escola_id", escolaId)
    .eq("ativo", true) // 👈 ISSO AQUI
    .order("nome");

  if (error) {
    setMsg("Erro ao carregar atletas: " + error.message);
    return;
  }

  setLista(data ?? []);
}

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (perfil?.escola_id) carregarAtletas(perfil.escola_id);
  }, [perfil?.escola_id]);

  // filtro local (rápido e sem custo no banco)
  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return lista;
    return lista.filter((a) => {
      const nome = (a.nome ?? "").toLowerCase();
      const cpf = (a.cpf ?? "").toLowerCase();
      return nome.includes(term) || cpf.includes(term);
    });
  }, [lista, q]);

  // paginação
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  }, [filtrados.length]);

  const paginaAtual = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [filtrados, page]);

  // se pesquisar e reduzir a lista, garantir página válida
  useEffect(() => {
    setPage(1);
  }, [q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestor • Atletas"
        subtitle="Lista de atletas da sua escola"
        right={
          <Link
            href="/gestor/atletas/novo"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
          >
            + Adicionar atleta
          </Link>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Atletas</div>
            <div className="text-sm text-zinc-600">
              {filtrados.length} encontrado(s)
              {q.trim() ? ` • filtro: “${q.trim()}”` : ""}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 sm:w-[260px]"
              placeholder="Pesquisar por nome ou CPF…"
            />
            <button
              onClick={() => carregarAtletas(perfil?.escola_id ?? 0)}
              className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
            >
              Atualizar
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {msg ? <div className="mb-3 text-sm text-zinc-700">{msg}</div> : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-600">
                <tr className="border-b">
                  <th className="py-2 pr-3">Atleta</th>
                  <th className="py-2 pr-3">Sexo</th>
                  <th className="py-2 pr-3">Doc</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {paginaAtual.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{a.nome}</div>
                      <div className="text-xs text-zinc-600">
                        CPF: {a.cpf ?? "—"} • Nasc.: {a.data_nascimento} • Categoria:{" "}
                        {calcCategoria(a.data_nascimento)}
                      </div>
                    </td>

                    <td className="py-2 pr-3">{a.sexo === "M" ? "Masculino" : "Feminino"}</td>

                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          a.status_doc === "CONCLUIDO"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-yellow-50 text-yellow-800"
                        }`}
                      >
                        {a.status_doc}
                      </span>
                    </td>

                    <td className="py-2 pr-3">{a.ativo ? "Ativo" : "Inativo"}</td>

                    <td className="py-2 text-right">
                      <Link
                        href={`/gestor/atletas/${a.id}/editar`}
                        className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-xs font-semibold hover:bg-zinc-50"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}

                {filtrados.length === 0 ? (
                  <tr>
                    <td className="py-3 text-zinc-600" colSpan={5}>
                      Nenhum atleta encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600">
              Página <span className="font-semibold">{page}</span> de{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold disabled:opacity-50"
              >
                « Primeira
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold disabled:opacity-50"
              >
                ‹ Anterior
              </button>

              {makePages(page, totalPages).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-10 rounded-xl border px-3 text-sm font-semibold ${
                    p === page ? "bg-blue-700 text-white border-blue-700" : "bg-white hover:bg-zinc-50"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold disabled:opacity-50"
              >
                Próxima ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold disabled:opacity-50"
              >
                Última »
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// mostra páginas próximas (ex.: 1 2 3 4 5)
function makePages(current: number, total: number) {
  const delta = 2;
  const start = Math.max(1, current - delta);
  const end = Math.min(total, current + delta);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}