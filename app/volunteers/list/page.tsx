import Link from "next/link";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import { StatusPill } from "@/components/dashboard/status-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { TableShell } from "@/components/site/table-shell";
import { listVolunteers } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

function fmt(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function VolunteersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const payload = await listVolunteers({ q, limit: 100, offset: 0 });

  return (
    <PageShell>
      <PageHero
        eyebrow="Volunteer OS"
        title="All volunteers"
        description="Search, triage, and connect people to the right lane. This is a human system: clarity, follow-up, and momentum."
        pills={
          <>
            <StatusPill tone="neutral">Showing {fmt(payload.rows.length)}</StatusPill>
            <StatusPill tone="neutral">County-first</StatusPill>
          </>
        }
        actions={
          <>
            <form className="flex w-full max-w-md gap-2" action="/volunteers/list" method="get">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, email, phone…"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
              />
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10">
                Search
              </button>
            </form>
            <Link
              href="/volunteers/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Dashboard
            </Link>
          </>
        }
      />

      <SectionCard title="Volunteer list" description="Newest first.">
        <TableShell>
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Name</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">County</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Onboarding</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payload.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    No volunteers yet.
                  </td>
                </tr>
              ) : (
                payload.rows.map((v) => (
                  <tr key={v.id} className="bg-slate-900/40 hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                      <Link className="hover:underline" href={`/volunteers/${v.id}`}>
                        {v.firstName || v.lastName
                          ? `${v.firstName ?? ""} ${v.lastName ?? ""}`.trim()
                          : `Volunteer #${v.id}`}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {v.countyName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {v.volunteerStatus}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {v.onboardingStatus}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {v.email ?? v.phone ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
    </PageShell>
  );
}

