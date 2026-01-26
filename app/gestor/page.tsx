"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

export default function GestorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Área do Gestor"
        subtitle="Gerencie sua equipe, atletas e documentos do evento"
      />

      {/* Ações rápidas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard
          href="/gestor/atletas"
          title="Atletas"
          desc="Cadastrar e gerenciar atletas"
        />
        <QuickCard
          href="/gestor/equipe"
          title="Equipe Técnica"
          desc="Técnicos, chefes e oficiais"
        />
        <QuickCard
          href="/gestor/documentos"
          title="Documentos"
          desc="Enviar e acompanhar documentos"
        />
        <QuickCard
          href="/gestor/inscricoes"
          title="Inscrições"
          desc="Modalidades e provas"
        />
      </div>

      {/* Avisos / Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="font-semibold">Pendências</div>
            <div className="text-sm text-zinc-600">
              Itens que precisam da sua atenção
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
              ⚠️ Alguns atletas ainda estão sem documentação completa.
            </div>

            <Link
              href="/gestor/documentos"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Ver documentos
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="font-semibold">Informações</div>
            <div className="text-sm text-zinc-600">
              Acompanhe o status geral
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              ✅ Inscrições abertas para o evento atual.
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
              ℹ️ Confira prazos e regulamentos antes de finalizar.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
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