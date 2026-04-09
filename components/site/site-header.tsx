import Link from "next/link";
import { StatusPill } from "@/components/dashboard/status-pill";
import { GlobalSearch } from "@/components/site/global-search";

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm shadow-black/20 hover:bg-white/10"
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const isProd = process.env.NODE_ENV === "production";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/75 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 md:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-violet-500/20 shadow-sm shadow-black/30" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-white">
              Kelly Grappe
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Secretary of State
            </p>
          </div>
        </Link>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:gap-2">
          <div className="md:order-2 md:min-w-[420px]">
            <GlobalSearch />
          </div>
          <nav className="flex flex-wrap items-center gap-2 md:order-1">
            <NavLink href="/counties" label="Counties" />
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/cm-hub" label="CM Hub" />
            <NavLink href="/command-center/calendar" label="Command Center" />
            {isProd ? (
              <StatusPill tone="neutral">Local-only</StatusPill>
            ) : (
              <StatusPill tone="success">Local active</StatusPill>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

