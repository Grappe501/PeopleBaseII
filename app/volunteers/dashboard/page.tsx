import Link from "next/link";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import { StatusPill } from "@/components/dashboard/status-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { getVolunteersDashboardPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function VolunteersDashboardPage() {
  const payload = await getVolunteersDashboardPayload();

  return (
    <PageShell>
      <PageHero
        eyebrow="Volunteer OS"
        title="Volunteer dashboard"
        description="Recruit → activate → retain → grow leaders. This module is built to stay human, simple, and action-oriented."
        pills={
          <>
            <StatusPill tone={payload.readiness.ready ? "success" : "neutral"}>
              {payload.readiness.ready ? "Ready" : "Not ready"}
            </StatusPill>
            <StatusPill tone="neutral">County-first organizing</StatusPill>
            <StatusPill tone="neutral">Next best action</StatusPill>
          </>
        }
        actions={
          <>
            <Link
              href="/volunteers/list"
              className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              View volunteers
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Back to main dashboard
            </Link>
          </>
        }
      />

      <SectionCard title="Pulse" description="High-level volunteer health metrics.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Total volunteers
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {fmtInt(payload.metrics.totalVolunteers)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Active volunteers
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {fmtInt(payload.metrics.activeVolunteers)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              New (7 days)
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {fmtInt(payload.metrics.newVolunteers7d)}
            </p>
          </div>
        </div>
      </SectionCard>

      {payload.alerts.length ? (
        <SectionCard title="Alerts" description="Operational issues that need attention.">
          <div className="space-y-3">
            {payload.alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200"
              >
                <span className="font-semibold text-white">{a.severity.toUpperCase()}</span>{" "}
                <span className="text-slate-300">{a.message}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </PageShell>
  );
}

