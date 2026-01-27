"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

type Perfil = { escola_id: number; municipio_id: number };

type DocStatus = "PENDENTE" | "CONCLUIDO" | "REJEITADO";

type Atleta = {
  id: number;
  nome: string;
  sexo: "M" | "F";
  ativo: boolean;
  doc_status?: DocStatus;
};

export default function AtletasPage() {
  const [msg, setMsg] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [atletas, setAtletas] = useState<Atleta[]>([]);
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
    if (!silencioso) setMsg(""); // ✅ não apaga msg quando a gente quiser manter

    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, sexo, ativo")
      .eq("escola_id", perfil.escola_id)
      .order("nome");

    if (error) {
      setCarregando(false);
      return setMsg("Erro ao carregar atletas: " + error.message);
    }

    const base = (data ?? []) as Atleta[];
    const ids = base.map((a) => a.id);

    // status docs em participante_arquivos
    const statusById = new Map<number, DocStatus>();
    if (ids.length > 0) {
      const { data: arqs, error: aErr } = await supabase
        .from("participante_arquivos")
        .select("participante_id, status")
        .eq("escola_id", perfil.escola_id)
        .eq("participante_tipo", "ATLETA")
        .in("participante_id", ids);

      if (aErr) console.warn("Erro ao carregar status docs:", aErr.message);

      (arqs ?? []).forEach((r: any) => {
        statusById.set(Number(r.participante_id), (r.status ?? "PENDENTE") as DocStatus);
      });
    }

    const merged = base.map((a) => ({
      ...a,
      doc_status: statusById.get(a.id) ?? "PENDENTE",
    }));

    setAtletas(merged);
    setCarregando(false);
  }

  async function excluirAtleta(atletaId: number) {
    if (!perfil?.escola_id) return;

    const atleta = atletas.find((a) => a.id === atletaId);
    const ok = window.confirm(
      `Tem certeza que deseja excluir (desativar) o atleta "${atleta?.nome ?? atletaId}"?\n\nIsso vai marcar como INATIVO (não apaga do sistema).`
    );
    if (!ok) return;

    setExcluindoId(atletaId);
    setMsg("");

    // ✅ tenta desativar
    const { data, error } = await supabase
      .from("atletas")
      .update({ ativo: false })
      .eq("id", atletaId)
      .eq("escola_id", perfil.escola_id)
      .select("id, ativo")
      .maybeSingle();

    setExcluindoId(null);

    if (error) {
      console.error("Erro ao excluir:", error);
      return setMsg("Erro ao excluir: " + error.message);
    }

    if (!data?.id) {
      console.warn("Nenhuma linha atualizada. Possível RLS bloqueando UPDATE.");
      return setMsg("Não foi possível desativar. Verifique permissões (RLS) no Supabase.");
    }

    // ✅ atualiza a tela sem depender do reload
    setAtletas((prev) =>
      prev.map((a) => (a.id === atletaId ? { ...a, ativo: false } : a))
    );

    // ✅ se não estiver mostrando inativos, remove da lista na hora
    if (!mostrarInativos) {
      setAtletas((prev) => prev.filter((a) => a.id !== atletaId));
    }

    setMsg("Atleta desativado ✅");
  }

  const filtrados = useMemo(() => {
    const b = busca.toLowerCase().trim();

    let lista = atletas;
    if (!mostrarInativos) lista = lista.filter((a) => a.ativo);

    if (!b) return lista;
    return lista.filter((a) => a.nome.toLowerCase().includes(b));
  }, [atletas, busca, mostrarInativos]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Atletas"
        subtitle="Gerencie os atletas da sua escola"
        right={
          <Link
            href="/gestor/atletas/novo"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
          >
            + Novo atleta
          </Link>
        }
      />

      {msg ? <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div> : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar atleta..."
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
            <div className="py-6 text-sm opacity-70">Nenhum atleta encontrado.</div>
          ) : (
            <div className="divide-y rounded-xl border">
              {filtrados.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{a.nome}</div>
                    <div className="text-xs opacity-70">
                      {a.sexo === "M" ? "Masculino" : "Feminino"} • Docs:{" "}
                      <b>{a.doc_status ?? "PENDENTE"}</b> • {a.ativo ? "Ativo" : "Inativo"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/gestor/atletas/${a.id}/editar`}
                      className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-zinc-50"
                    >
                      Ver
                    </Link>

                    <Link
                      href={`/gestor/atletas/${a.id}/editar`}
                      className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-semibold hover:bg-zinc-50"
                    >
                      Editar
                    </Link>

                    <button
                      onClick={() => excluirAtleta(a.id)}
                      disabled={excluindoId === a.id}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      title="Desativar atleta"
                    >
                      {excluindoId === a.id ? "..." : "Excluir"}
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