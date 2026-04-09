import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";

export const dynamic = "force-dynamic";

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
    >
      {label}
    </Link>
  );
}

export default function CmHubLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <PageHero
        eyebrow="Campaign Manager Hub"
        title="CM Hub"
        description="Command center • reporting center • coordination layer • escalation point. Every dashboard feeds into this brain."
        actions={
          <>
            <NavItem href="/cm-hub" label="Overview" />
            <NavItem href="/cm-hub/cm" label="Campaign Manager" />
            <NavItem href="/cm-hub/asst" label="Assistant CM" />
            <NavItem href="/cm-hub/candidate" label="Candidate" />
            <NavItem href="/cm-hub/field" label="Field" />
            <NavItem href="/cm-hub/volunteers" label="Volunteers" />
            <NavItem href="/cm-hub/events" label="Events" />
            <NavItem href="/cm-hub/comms" label="Comms" />
            <NavItem href="/cm-hub/social" label="Social" />
            <NavItem href="/cm-hub/digital" label="Digital" />
            <NavItem href="/cm-hub/fundraising" label="Fundraising" />
            <NavItem href="/cm-hub/data" label="Data & Intelligence" />
            <NavItem href="/cm-hub/reports" label="Reports" />
            <NavItem href="/cm-hub/workflows" label="Workflows" />
            <NavItem href="/cm-hub/system-status" label="System status" />
          </>
        }
      />
      {children}
    </PageShell>
  );
}

