"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type NavItem = { href: string; label: string };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("Admin");

  const sections = useMemo(() => {
    const CADASTROS: NavItem[] = [
      { href: "/admin/modalidades", label: "Modalidades" },
      { href: "/admin/eventos", label: "Eventos" },
      { href: "/admin/escolas", label: "Escolas" },
      { href: "/admin/gestores", label: "Gestores" },
      { href: "/admin/municipios", label: "Municípios" },
      { href: "/admin/admins", label: "Administradores" },
    ];

    const CONFERENCIA: NavItem[] = [
      { href: "/admin/substituicoes", label: "Substituições" },
      { href: "/admin/pendencias", label: "Pendências" },
      { href: "/admin/relatorios", label: "Relatórios" },
      { href: "/admin/crachas", label: "Crachás" },
    ];

    const CONFIG: NavItem[] = [{ href: "/admin/configurar/provas", label: "Provas" }];

    return { CADASTROS, CONFERENCIA, CONFIG };
  }, []);

  function isActive(href: string) {
    if (pathname === href) return true;
    return pathname.startsWith(href + "/");
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email ?? "Admin";
      setUserEmail(email);
    })();
  }, []);

  useEffect(() => {
    // sempre que mudar rota, fecha o menu mobile
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[280px_1fr]">
        {/* SIDEBAR DESKTOP */}
        <aside className="sticky top-0 hidden h-dvh bg-blue-800 md:block">
          <Brand />

          <nav className="p-3 text-sm text-white/90">
            <SectionTitle>Cadastros</SectionTitle>
            {sections.CADASTROS.map((it) => (
              <SidebarLink key={it.href} href={it.href} label={it.label} active={isActive(it.href)} />
            ))}

            <Divider />

            <SectionTitle>Conferência</SectionTitle>
            {sections.CONFERENCIA.map((it) => (
              <SidebarLink key={it.href} href={it.href} label={it.label} active={isActive(it.href)} />
            ))}

            <Divider />

            <SectionTitle>Configurações</SectionTitle>
            {sections.CONFIG.map((it) => (
              <SidebarLink key={it.href} href={it.href} label={it.label} active={isActive(it.href)} />
            ))}
          </nav>

          <SidebarFooter />
        </aside>

        {/* MAIN */}
        <div className="min-w-0">
          {/* TOPBAR */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-2">
              {/* BOTÃO MENU (mobile) */}
              <button
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-zinc-700 hover:bg-zinc-50 md:hidden"
                aria-label="Abrir menu"
              >
                ☰
              </button>

              <span className="inline-flex h-9 items-center rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white">
                Painel Administrativo
              </span>
              <span className="hidden text-sm text-zinc-500 sm:inline">JERS • IDJUV</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-sm font-medium text-zinc-600 sm:block">{userEmail}</div>

              <button
                onClick={sair}
                className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
              >
                Sair
              </button>
            </div>
          </header>

          {/* CONTEÚDO */}
          <main className="p-4 md:p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      {/* SIDEBAR MOBILE (DRAWER) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-blue-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
              <div className="text-white">
                <div className="text-sm font-bold">JERS</div>
                <div className="text-xs opacity-80">IDJUV • Admin</div>
              </div>

              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Fechar
              </button>
            </div>

            <nav className="p-3 text-sm text-white/90">
              <SectionTitle>Cadastros</SectionTitle>
              {sections.CADASTROS.map((it) => (
                <SidebarLink key={it.href} href={it.href} label={it.label} active={isActive(it.href)} />
              ))}

              <Divider />

              <SectionTitle>Conferência</SectionTitle>
              {sections.CONFERENCIA.map((it) => (
                <SidebarLink key={it.href} href={it.href} label={it.label} active={isActive(it.href)} />
              ))}

              <Divider />

              <SectionTitle>Configurações</SectionTitle>
              {sections.CONFIG.map((it) => (
                <SidebarLink key={it.href} href={it.href} label={it.label} active={isActive(it.href)} />
              ))}
            </nav>

            <div className="border-t border-white/15 p-4">
              <div className="text-xs text-white/70">
                Instituto de Desporto, Juventude e Lazer — RR
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-white/15 px-4">
      <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white">
        <Image src="/idjuv.png" alt="IDJUV" fill className="object-contain p-1" priority />
      </div>

      <div className="leading-tight text-white">
        <div className="text-sm font-bold tracking-tight">JERS</div>
        <div className="text-xs opacity-80">IDJUV • Admin</div>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-white/15 p-4">
      <div className="text-xs text-white/70">Instituto de Desporto, Juventude e Lazer — RR</div>
    </div>
  );
}

function SidebarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "block rounded-xl px-3 py-2 transition",
        active
          ? "bg-white/15 text-white shadow-sm"
          : "text-white/90 hover:bg-blue-700 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-white/70">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-3 border-t border-white/15" />;
}
