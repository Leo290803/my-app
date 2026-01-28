import Link from "next/link";
import Image from "next/image";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-dvh bg-blue-800 md:block">
          {/* Brand */}
          <div className="flex h-16 items-center gap-3 border-b border-white/15 px-4">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white">
              <Image
                src="/idjuv.png"
                alt="IDJUV"
                fill
                className="object-contain p-1"
                priority
              />
            </div>

            <div className="leading-tight text-white">
              <div className="text-sm font-bold tracking-tight">JERS</div>
              <div className="text-xs opacity-80">IDJUV • Admin</div>
            </div>
          </div>

          <nav className="p-3 text-sm text-white/90">
            <SectionTitle>Cadastros</SectionTitle>
            <SidebarLink href="/admin/modalidades" label="Modalidades" />
            <SidebarLink href="/admin/eventos" label="Eventos" />
            <SidebarLink href="/admin/escolas" label="Escolas" />
            <SidebarLink href="/admin/gestores" label="Gestores" />
            <SidebarLink href="/admin/municipios" label="Municípios" />
            <SidebarLink href="/admin/admins" label="Administradores" />
            


            <Divider />

            <SectionTitle>Conferência</SectionTitle>
            <SidebarLink href="/admin/conferencia" label="Conferência" />
            <SidebarLink href="/admin/substituicoes" label="Substituições" />
            <SidebarLink href="/admin/pendencias" label="Pendências" />
            <SidebarLink href="/admin/relatorios" label="Relatórios" />
            <SidebarLink href="/admin/crachas" label="Crachás" />

            <Divider />

            <SectionTitle>Configurações</SectionTitle>
            <SidebarLink href="/admin/configurar/provas" label="Provas" />
          </nav>

          {/* Rodapé sidebar */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/15 p-4">
            <div className="text-xs text-white/70">
              Instituto de Desporto, Juventude e Lazer — RR
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 items-center rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white">
                Painel Administrativo
              </span>
              <span className="hidden text-sm text-zinc-500 sm:inline">
                JERS • IDJUV
              </span>
            </div>

            <div className="text-sm font-medium text-zinc-600">Admin</div>
          </header>

          <main className="p-4 md:p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2 text-white/90 hover:bg-blue-700 hover:text-white transition"
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