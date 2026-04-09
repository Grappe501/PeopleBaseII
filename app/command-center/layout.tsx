import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/site/page-hero";

export const dynamic = "force-dynamic";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-black/20 hover:bg-white/10"
    >
      {children}
    </Link>
  );
}

export default function CommandCenterLayout({ children }: { children: ReactNode }) {
  return (
    <main className="kg-grain min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 md:px-10 md:py-12">
        <PageHero
          eyebrow="Command Center (local only)"
          title="Communications & calendar control"
          description="This module is an admin control center and is blocked in production deployments."
          actions={
            <>
              <NavLink href="/command-center/dashboard">Overview</NavLink>
              <NavLink href="/command-center/calendar">Calendar</NavLink>
              <NavLink href="/counties">County intelligence</NavLink>
              <NavLink href="/dashboard">Data dashboard</NavLink>
            </>
          }
        />
        {children}
      </div>
    </main>
  );
}

