import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { listStatewideCounties } from "@/lib/queries/county-pages";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { listUpcomingEvents } from "@/lib/queries/events";
import { StatusPill } from "@/components/dashboard/status-pill";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import { TableShell } from "@/components/site/table-shell";
import { CreateWorkflowTaskButton } from "@/components/cm-hub/create-workflow-task-button";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function CountiesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const qParam = sp.q;
  const q = typeof qParam === "string" ? qParam : "";

  const [counties, events] = await Promise.all([
    listStatewideCounties({ q }),
    listUpcomingEvents({ level: "statewide", limit: 12 }),
  ]);

  return (
    <PageShell>
      <PageHero
        eyebrow="County intelligence"
        title="Arkansas counties"
        description="Drill down: county → places → precincts. Targets and calendar rollups stay consistent from statewide down to the smallest actionable level."
        pills={
          <>
            <StatusPill tone="neutral">Serve all 75 counties</StatusPill>
            <StatusPill tone="neutral">Transparency-first</StatusPill>
            <StatusPill tone="neutral">Rollup events calendar</StatusPill>
          </>
        }
        actions={
          <form className="flex w-full max-w-md gap-2" action="/counties" method="get">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search county…"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            />
            <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10">
              Search
            </button>
          </form>
        }
      />

        <SectionCard
          title="County list"
          description="Sorted by county_priority_score (then electorate)."
        >
          <TableShell>
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">County</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">VR unique</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Expected turnout</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Target votes</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {counties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                      No counties found.
                    </td>
                  </tr>
                ) : (
                  counties.map((c) => (
                    <tr key={c.countyId} className="bg-slate-900/40 hover:bg-slate-800/60">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                        {c.countyKey ? (
                          <Link className="hover:underline" href={`/counties/${c.countyKey}`}>
                            {c.countyName}
                          </Link>
                        ) : (
                          c.countyName
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.vrUniqueVoters)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.expectedTurnoutVotes)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.countyTargetVotes)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                        {c.countyPriorityScore != null ? c.countyPriorityScore.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </SectionCard>

        <CalendarPanel
          title="Statewide calendar"
          description="Every event appears upstream here."
          events={events}
          actionsForEvent={(e) => (
            <CreateWorkflowTaskButton
              label="Task"
              defaultTitle={`[Counties] Event: ${e.title}`}
              eventId={e.eventId}
              defaultDepartment="events"
              defaultPriority="medium"
            />
          )}
        />
    </PageShell>
  );
}

