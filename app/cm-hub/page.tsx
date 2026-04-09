import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { getVolunteersDashboardPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function CmHubOverviewPage() {
  const volunteers = await getVolunteersDashboardPayload();

  return (
    <>
      <SectionCard
        title="Campaign snapshot"
        description="Top-line operating metrics (some modules are placeholders until integrations land)."
      >
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { k: "Active Volunteers", v: fmtInt(volunteers.metrics.activeVolunteers) },
            { k: "Counties Active", v: "—" },
            { k: "Events This Week", v: "—" },
            { k: "Messages Sent", v: "—" },
            { k: "Funds Raised", v: "—" },
            { k: "Field Contacts Made", v: "—" },
          ].map((c) => (
            <div key={c.k} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                {c.k}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{c.v}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Performance by department"
        description="Status + key metric + risk + owner. (Owners become real once user roles land.)"
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Key metric</th>
                <th className="px-3 py-2 font-medium">Risk</th>
                <th className="px-3 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="bg-slate-900/40">
                <td className="px-3 py-2 font-semibold text-white">Field</td>
                <td className="px-3 py-2">
                  <StatusPill tone="neutral">🟡</StatusPill>
                </td>
                <td className="px-3 py-2 text-slate-300">Turf completion —</td>
                <td className="px-3 py-2 text-slate-300">Staffing gap</td>
                <td className="px-3 py-2 text-slate-400">Field Manager</td>
              </tr>
              <tr className="bg-slate-900/40">
                <td className="px-3 py-2 font-semibold text-white">Volunteers</td>
                <td className="px-3 py-2">
                  <StatusPill tone={volunteers.metrics.totalVolunteers ? "success" : "neutral"}>
                    🟢
                  </StatusPill>
                </td>
                <td className="px-3 py-2 text-slate-300">
                  Total {fmtInt(volunteers.metrics.totalVolunteers)}
                </td>
                <td className="px-3 py-2 text-slate-300">Low</td>
                <td className="px-3 py-2 text-slate-400">Volunteer Coordinator</td>
              </tr>
              <tr className="bg-slate-900/40">
                <td className="px-3 py-2 font-semibold text-white">Comms</td>
                <td className="px-3 py-2">
                  <StatusPill tone="neutral">🟢</StatusPill>
                </td>
                <td className="px-3 py-2 text-slate-300">Reply rate —</td>
                <td className="px-3 py-2 text-slate-300">—</td>
                <td className="px-3 py-2 text-slate-400">Comms Director</td>
              </tr>
              <tr className="bg-slate-900/40">
                <td className="px-3 py-2 font-semibold text-white">Events</td>
                <td className="px-3 py-2">
                  <StatusPill tone="danger">🔴</StatusPill>
                </td>
                <td className="px-3 py-2 text-slate-300">Understaffed —</td>
                <td className="px-3 py-2 text-slate-300">High</td>
                <td className="px-3 py-2 text-slate-400">Events Lead</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Alerts & bottlenecks" description="Escalations and operational blockers.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Alerts
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Staffing gaps (coming next)</li>
              <li>Missed deadlines (coming next)</li>
              <li>Unapproved messages (coming next)</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Bottlenecks
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Unassigned tasks (workflows module next)</li>
              <li>Follow-up backlog (field + comms)</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Cross-team workflow"
        description="Goal → task → owner → status → dependency. This will become an Asana-style pipeline in /cm-hub/workflows."
      >
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
          Next: tasks with owners, dependencies, and linked county/field objects.
          <div className="mt-4">
            <Link className="text-sm font-semibold text-sky-200 hover:underline" href="/cm-hub/workflows">
              Open workflows →
            </Link>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

