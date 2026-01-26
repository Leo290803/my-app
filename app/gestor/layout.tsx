import Link from "next/link";
import Image from "next/image";


export default function GestorLayout({ children }: { children: React.ReactNode }) {
return (
<div className="min-h-dvh bg-zinc-50 text-zinc-900">
{/* Topbar */}
<header className="sticky top-0 z-10 border-b bg-white">
<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
<div className="flex items-center gap-3">
<div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
<Image
src="/idjuv.png"
alt="IDJUV"
fill
className="object-contain p-1"
priority
/>
</div>


<div className="leading-tight">
<div className="text-sm font-bold tracking-tight">JERS</div>
<div className="text-xs text-zinc-500">Área do Gestor • IDJUV</div>
</div>
</div>


<div className="hidden items-center gap-2 sm:flex">
<span className="rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">
Gestor
</span>
</div>
</div>


{/* Menu */}
<div className="bg-blue-800">
<div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-2 py-2 text-sm text-white/90">
<NavLink href="/gestor" label="Início" />
<NavLink href="/gestor/atletas" label="Cadastro de Atletas" />
<NavLink href="/gestor/equipe" label="Cadastro de Comissão Técnica" />
<NavLink href="/gestor/inscricoes" label="Inscrições" />
<NavLink href="/gestor/pendencias" label="Pendências" />
<NavLink href="/gestor/equipes" label="Equipes" />
<NavLink href="/gestor/participantes" label="Participantes" />
<NavLink href="/gestor/documentos" label="Documentos" />

</div>
</div>
</header>


{/* Conteúdo */}
<main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>


{/* Rodapé */}
<footer className="mt-10 border-t bg-white">
<div className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-500">
IDJUV — Instituto de Desporto, Juventude e Lazer do Estado de Roraima
</div>
</footer>
</div>
);
}


function NavLink({ href, label }: { href: string; label: string }) {
return (
<Link
href={href}
className="rounded-lg px-3 py-2 hover:bg-blue-700 hover:text-white transition whitespace-nowrap"
>
{label}
</Link>
);
}