import { AskPanel } from "@/components/dashboard/ask-panel";
import { CountySummaryTable } from "@/components/dashboard/county-summary-table";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCountySummary,
  getDashboardOverview,
} from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [overview, counties] = await Promise.all([
    getDashboardOverview(),
    getCountySummary(25),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-10">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-2xl shadow-black/30">
          <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_0.8fr] md:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill tone={overview.databaseOnline ? "success" : "danger"}>
                  {overview.databaseOnline ? "Database Online" : "Database Offline"}
                </StatusPill>
                <StatusPill tone="neutral">Statewide Command View</StatusPill>
                <StatusPill tone="neutral">Modular Build</StatusPill>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  PeopleBaseII
                </p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  Statewide race command center
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  This dashboard is the first-class shell for the campaign data system:
                  live database metrics, county-level summaries, and the future home of
                  AI-assisted analysis, simulations, and strategic reporting.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Mission focus
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Current dataset</p>
                  <p className="text-lg font-semibold">Raw voter registration intake</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Current priority</p>
                  <p className="text-lg font-semibold">Build trusted data + transparent analytics</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Next module</p>
                  <p className="text-lg font-semibold">AR-02 filtered intelligence layer</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <OverviewCards overview={overview} />

        <section className="grid gap-6 xl:grid-cols-[1.55fr_420px]">
          <SectionCard
            title="County voter footprint"
            description="Live county counts from raw_vr. This is the first operational table in the campaign command center."
          >
            <CountySummaryTable rows={counties} />
          </SectionCard>

          <div className="flex flex-col gap-6">
            <AskPanel />
            <SectionCard
              title="Simulation bay"
              description="Reserved for turnout, persuasion, and county mix simulations."
            >
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-4">
                  <p className="font-medium text-white">Coming next</p>
                  <p className="mt-1 text-slate-400">
                    Scenario modeling for turnout shifts, Black turnout lift, county
                    mix changes, and statewide vote target planning.
                  </p>
                </div>
                <ul className="space-y-2 text-slate-400">
                  <li>• Simulate +3% turnout in target counties</li>
                  <li>• Estimate Black Democratic vote growth scenarios</li>
                  <li>• Compare persuasion vs turnout paths</li>
                </ul>
              </div>
            </SectionCard>

            <SectionCard
              title="System notes"
              description="First-class build standards for PeopleBaseII."
            >
              <ul className="space-y-2 text-sm text-slate-300">
                <li>• Server-side secrets only</li>
                <li>• Modular dashboard components</li>
                <li>• Query layer separated from UI layer</li>
                <li>• AI access should use guarded backend actions</li>
              </ul>
            </SectionCard>
          </div>
        </section>
      </div>
    </main>
  );
}
