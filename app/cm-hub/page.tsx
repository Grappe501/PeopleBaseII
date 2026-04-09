import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TableShell } from "@/components/site/table-shell";
import { getCountiesActiveCount, getKpiIntelligencePayload } from "@/lib/queries/kpi-intelligence";
import { getVolunteersDashboardPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function CmHubOverviewPage() {
  const [kpi, volunteers, countiesActive] = await Promise.all([
    getKpiIntelligencePayload(12),
    getVolunteersDashboardPayload(),
    getCountiesActiveCount(),
  ]);

  const c = kpi.campaign;

  return (
    <>
      <SectionCard
        title="Campaign snapshot"
        description={`KPI intelligence (${c.source === "materialized" ? "materialized cache" : "live view"}). Schedule refresh_kpi_intel() or POST /api/intelligence/kpi/refresh for heavy traffic.`}
      >
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {[
            { k: "People (graph)", v: fmtInt(c.peopleTotal) },
            { k: "People • volunteers", v: fmtInt(c.peopleVolunteers) },
            { k: "Volunteers • active", v: fmtInt(c.activeVolunteers) },
            { k: "Counties active", v: fmtInt(countiesActive) },
            { k: "Events this week", v: fmtInt(c.eventsThisWeek) },
            { k: "Outbound msgs (7d)", v: fmtInt(c.commsOutbound7d) },
            { k: "Field contacts (7d)", v: fmtInt(c.fieldContacts7d) },
            { k: "Workflows open", v: fmtInt(c.openWorkflowTasks) },
            { k: "Workflows blocked", v: fmtInt(c.blockedWorkflowTasks) },
            { k: "Funds raised", v: "—" },
          ].map((row) => (
            <div key={row.k} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                {row.k}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{row.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Computed {new Date(c.computedAt).toLocaleString()}{" "}
          <a className="text-sky-300 hover:underline" href="/api/intelligence/kpi">
            JSON
          </a>
        </p>
      </SectionCard>

      <SectionCard
        title="Top counties (intelligence rank)"
        description="Sorted by statewide priority score + operational signals. Drill down for full county profile."
      >
        <TableShell>
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">County</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">VR</th>
                <th className="px-3 py-2 font-medium">Target votes</th>
                <th className="px-3 py-2 font-medium">Field 30d</th>
                <th className="px-3 py-2 font-medium">Events 14d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {kpi.topCounties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No county intelligence yet (run migration 040 and refresh_kpi_intel).
                  </td>
                </tr>
              ) : (
                kpi.topCounties.map((row) => (
                  <tr key={row.countyId} className="bg-slate-900/40">
                    <td className="px-3 py-2 font-semibold text-white">
                      {row.countyKey ? (
                        <Link
                          className="text-sky-200 hover:underline"
                          href={`/counties/${encodeURIComponent(row.countyKey)}`}
                        >
                          {row.countyName}
                        </Link>
                      ) : (
                        row.countyName
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {row.intelPriorityScore != null ? row.intelPriorityScore.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{fmtInt(row.vrUniqueVoters)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmtInt(row.targetVotesProportional)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmtInt(row.fieldContacts30d)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmtInt(row.eventsNext14d)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
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
                <td className="px-3 py-2 text-slate-300">
                  Contacts 7d {fmtInt(c.fieldContacts7d)}
                </td>
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
                <td className="px-3 py-2 text-slate-300">Sent 7d {fmtInt(c.commsOutbound7d)}</td>
                <td className="px-3 py-2 text-slate-300">—</td>
                <td className="px-3 py-2 text-slate-400">Comms Director</td>
              </tr>
              <tr className="bg-slate-900/40">
                <td className="px-3 py-2 font-semibold text-white">Events</td>
                <td className="px-3 py-2">
                  <StatusPill tone="neutral">🟡</StatusPill>
                </td>
                <td className="px-3 py-2 text-slate-300">This week {fmtInt(c.eventsThisWeek)}</td>
                <td className="px-3 py-2 text-slate-300">—</td>
                <td className="px-3 py-2 text-slate-400">Events Lead</td>
              </tr>
              <tr className="bg-slate-900/40">
                <td className="px-3 py-2 font-semibold text-white">Data / workflows</td>
                <td className="px-3 py-2">
                  <StatusPill tone={c.blockedWorkflowTasks ? "danger" : "neutral"}>
                    {c.blockedWorkflowTasks ? "🔴" : "🟢"}
                  </StatusPill>
                </td>
                <td className="px-3 py-2 text-slate-300">
                  Open {fmtInt(c.openWorkflowTasks)} · Blocked {fmtInt(c.blockedWorkflowTasks)}
                </td>
                <td className="px-3 py-2 text-slate-300">{c.blockedWorkflowTasks ? "Blocked tasks" : "—"}</td>
                <td className="px-3 py-2 text-slate-400">Campaign Manager</td>
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
              <li>Unassigned tasks — see workflows</li>
              <li>Follow-up backlog (field + comms)</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Cross-team workflow"
        description="Goal → task → owner → status → dependency."
      >
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
          <Link className="text-sm font-semibold text-sky-200 hover:underline" href="/cm-hub/workflows">
            Open workflows →
          </Link>
        </div>
      </SectionCard>
    </>
  );
}
