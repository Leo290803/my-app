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

type EquipeRow = {
  id: number;
  nome: string;
  cpf: string | null;
  funcao: string;
  status_doc: "PENDENTE" | "CONCLUIDO";
  cref: string | null;
  ativo: boolean;
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export default function EquipeTecnicaListaPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<EquipeRow[]>([]);
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [q, setQ] = useState("");

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

  async function carregarLista(escolaId: number) {
    setMsg("");
    setCarregando(true);

    const { data, error } = await supabase
      .from("equipe_tecnica")
      .select("id,nome,cpf,funcao,status_doc,cref,ativo")
      .eq("escola_id", escolaId)
      .eq("ativo", true) // ✅ só ativos (para “sumir” da lista)
      .order("nome");

    setCarregando(false);

    if (error) return setMsg("Erro ao carregar lista: " + error.message);

    setLista((data ?? []) as EquipeRow[]);
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (perfil?.escola_id) carregarLista(perfil.escola_id);
  }, [perfil?.escola_id]);

  const filtrada = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return lista;

    const termoDigits = onlyDigits(termo);

    return lista.filter((p) => {
      const nome = (p.nome ?? "").toLowerCase();
      const cpf = onlyDigits(p.cpf ?? "");
      const cref = (p.cref ?? "").toLowerCase();
      return (
        nome.includes(termo) ||
        (termoDigits && cpf.includes(termoDigits)) ||
        cref.includes(termo)
      );
    });
  }, [q, lista]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe técnica / oficiais"
        subtitle="Lista de cadastros (ativos)"
        right={
          <div className="flex gap-2">
            <Link
              href="/gestor/equipe/novo"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Novo cadastro
            </Link>
          </div>
        }
      />

      {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Pesquisar</div>
          <div className="text-sm text-zinc-600">
            Pesquise por <b>nome</b>, <b>CPF</b> ou <b>CREF</b>
          </div>
        </CardHeader>
        <CardContent>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite para pesquisar..."
            className="h-11 w-full rounded-xl border bg-white px-3 outline-none focus:ring-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">
            Lista ({filtrada.length}) {carregando ? "• Carregando..." : ""}
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {filtrada.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold">{p.nome}</div>
                <div className="text-sm text-zinc-600">
                  Função: {p.funcao.replaceAll("_", " ")} • Status: {p.status_doc}
                </div>
                <div className="text-sm text-zinc-600">
                  CPF: {p.cpf ?? "—"} • CREF: {p.cref ?? "—"}
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/gestor/equipe/${p.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}

          {!carregando && filtrada.length === 0 ? (
            <div className="rounded-xl border bg-white p-3 text-sm text-zinc-600">
              Nenhum cadastro encontrado.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}