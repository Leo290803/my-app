"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data?.user?.email ?? null);
      setLoading(false);
    })();
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Área do Admin"
        subtitle={loading ? "Carregando..." : userEmail ? `Logado como ${userEmail}` : "Sem sessão"}
        right={
          <button
            onClick={sair}
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
          >
            Sair
          </button>
        }
      />

      {/* Ações rápidas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard href="/admin/eventos" title="Eventos" desc="Criar e gerenciar eventos" />
        <QuickCard href="/admin/escolas" title="Escolas" desc="Cadastrar escolas" />
        <QuickCard href="/admin/gestores" title="Gestores" desc="Criar gestores" />
        <QuickCard href="/admin/crachas" title="Crachás" desc="Gerar crachás e lote" />
        <QuickCard href="/admin/municipios" title="Municípios" desc="Gerenciar municípios" />
      </div>

      {/* Blocos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-start justify-between">
            <div>
              <div className="font-semibold">Conferência</div>
              <div className="text-sm text-zinc-600">Verificar participantes e status</div>
            </div>

            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
              Em andamento
            </span>
          </CardHeader>

          <CardContent className="grid gap-3">
            <Link
              href="/admin/conferencia"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Abrir conferência
            </Link>

            <Link
              href="/admin/substituicoes"
              className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
            >
              Ver substituições
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="font-semibold">Configurações</div>
            <div className="text-sm text-zinc-600">Regras e ajustes do evento</div>
          </CardHeader>

          <CardContent className="grid gap-3">
            <Link
              href="/admin/configurar/provas"
              className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
            >
              Configurar provas
            </Link>

            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              Dica: mantenha as provas atualizadas antes de liberar a conferência.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-blue-800">{title}</div>
          <div className="mt-1 text-sm text-zinc-600">{desc}</div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200">
          →
        </div>
      </div>
    </Link>
  );
}