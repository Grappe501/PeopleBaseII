import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import sql from "@/lib/db";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { listUpcomingEvents } from "@/lib/queries/events";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function CommandCenterDashboardPage() {
  const [events, counts] = await Promise.all([
    listUpcomingEvents({ level: "statewide", limit: 8 }),
    sql<
      Array<{
        draft: string | number;
        in_review: string | number;
        approved: string | number;
        rejected: string | number;
      }>
    >`
      select
        count(*) filter (where event_status = 'draft')::bigint as draft,
        count(*) filter (where event_status = 'in_review')::bigint as in_review,
        count(*) filter (where event_status = 'approved')::bigint as approved,
        count(*) filter (where event_status = 'rejected')::bigint as rejected
      from public.events
    `,
  ]);

  const c = counts[0] ?? { draft: 0, in_review: 0, approved: 0, rejected: 0 };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Command Center dashboard"
        description="Calendar approvals and statewide execution status. (Local only.)"
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Drafts
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(Number(c.draft))}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              In review
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {fmtInt(Number(c.in_review))}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Approved
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {fmtInt(Number(c.approved))}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Rejected
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {fmtInt(Number(c.rejected))}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/command-center/calendar"
            className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
          >
            Open calendar workflow
          </Link>
          <Link
            href="/counties"
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Go to counties
          </Link>
        </div>
      </SectionCard>

      <CalendarPanel
        title="Upcoming approved events"
        description="Statewide rollup calendar (approved + published only)."
        events={events}
      />
    </div>
  );
}

