"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Perfil = { escola_id: number; municipio_id: number };

type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";

type EquipeTecnica = {
  id: number;
  nome: string;
  cpf: string | null;
  funcao: string | null;
  cref: string | null;
  email: string | null;
  telefone: string | null;
  status_doc: DocStatus | null;
  ativo: boolean;
};

const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

export default function EquipePage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<EquipeTecnica[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

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
    carregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.escola_id]);

  async function carregar(silencioso = false) {
    if (!perfil?.escola_id) return;

    setCarregando(true);
    if (!silencioso) setMsg("");

    const { data, error } = await supabase
      .from("equipe_tecnica")
      .select("id,nome,cpf,funcao,cref,email,telefone,status_doc,ativo")
      .eq("escola_id", perfil.escola_id)
      .order("nome");

    setCarregando(false);

    if (error) return setMsg("Erro ao carregar equipe: " + error.message);

    setLista((data ?? []) as EquipeTecnica[]);
  }

  async function excluir(id: number) {
    if (!perfil?.escola_id) return;

    const item = lista.find((x) => x.id === id);
    const ok = window.confirm(
      `Tem certeza que deseja excluir (desativar) "${item?.nome ?? id}"?\n\nIsso vai marcar como INATIVO (não apaga do sistema).`
    );
    if (!ok) return;

    setExcluindoId(id);
    setMsg("");

    const { data, error } = await supabase
      .from("equipe_tecnica")
      .update({ ativo: false })
      .eq("id", id)
      .eq("escola_id", perfil.escola_id)
      .select("id, ativo")
      .maybeSingle();

    setExcluindoId(null);

    if (error) return setMsg("Erro ao excluir: " + error.message);
    if (!data?.id) return setMsg("Não foi possível desativar. Verifique permissões (RLS).");

    setLista((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: false } : x)));
    if (!mostrarInativos) setLista((prev) => prev.filter((x) => x.id !== id));

    setMsg("Cadastro desativado ✅");
  }

  const filtrados = useMemo(() => {
    const b = busca.toLowerCase().trim();
    const bDigits = onlyDigits(b);

    let l = lista;
    if (!mostrarInativos) l = l.filter((x) => x.ativo);

    if (!b) return l;

    return l.filter((x) => {
      const nome = (x.nome ?? "").toLowerCase();
      const cpf = onlyDigits(x.cpf ?? "");
      const cref = (x.cref ?? "").toLowerCase();
      return (
        nome.includes(b) ||
        (bDigits && cpf.includes(bDigits)) ||
        cref.includes(b)
      );
    });
  }, [lista, busca, mostrarInativos]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cadastro de Comissão Técnica"
        subtitle="Gerencie os cadastros da equipe técnica"
        right={
          <Link
            href="/gestor/equipe/novo"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
          >
            + Novo cadastro
          </Link>
        }
      />

      {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Pesquisar</div>
          <div className="text-sm text-zinc-600">Nome, CPF ou CREF</div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="h-11 w-full rounded-xl border bg-white px-3 outline-none focus:ring-2 sm:max-w-md"
            />

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mostrarInativos}
                  onChange={(e) => setMostrarInativos(e.target.checked)}
                />
                Mostrar inativos
              </label>

              <button
                onClick={() => carregar(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
              >
                Recarregar
              </button>
            </div>
          </div>

          {carregando ? (
            <div className="py-6 text-sm opacity-70">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="py-6 text-sm opacity-70">Nenhum cadastro encontrado.</div>
          ) : (
            <div className="divide-y rounded-xl border">
              {filtrados.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.nome}</div>
                    <div className="text-xs opacity-70">
                      Função: {p.funcao ?? "—"} • CREF: {p.cref ?? "—"} • Docs:{" "}
                      <b>{(p.status_doc ?? "PENDENTE") as DocStatus}</b> •{" "}
                      {p.ativo ? "Ativo" : "Inativo"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/gestor/equipe/${p.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-zinc-50"
                    >
                      Editar
                    </Link>

                    <button
                      onClick={() => excluir(p.id)}
                      disabled={excluindoId === p.id}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      title="Desativar"
                    >
                      {excluindoId === p.id ? "..." : "Excluir"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}