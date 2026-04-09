import { AskPanel } from "@/components/dashboard/ask-panel";
import { IntelligenceCommandPanel } from "@/components/dashboard/intelligence-command-panel";
import { VoterSegmentPanel } from "@/components/dashboard/voter-segment-panel";
import { AnalyticsOverviewCards } from "@/components/dashboard/analytics-overview-cards";
import { BlsSummaryPanel } from "@/components/dashboard/bls-summary-panel";
import { CensusSummaryPanel } from "@/components/dashboard/census-summary-panel";
import { CountyPowerProfileTable } from "@/components/dashboard/county-power-profile-table";
import { CountySummaryTable } from "@/components/dashboard/county-summary-table";
import { DataStatusPanel } from "@/components/dashboard/data-status-panel";
import { ElectionSummaryPanel } from "@/components/dashboard/election-summary-panel";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { RegistrationGapPanel } from "@/components/dashboard/registration-gap-panel";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import Link from "next/link";
import { getBlsStatus, getLatestBlsCountySummary } from "@/lib/queries/bls";
import { getCensusCountyRows, getCensusStatus } from "@/lib/queries/census";
import {
  getCountyAnalyticsOverview,
  getCountyPowerProfiles,
  getCountyRegistrationGaps,
} from "@/lib/queries/analytics";
import {
  getCountySummary,
  getDashboardOverview,
  getDashboardStatus,
} from "@/lib/queries/dashboard";
import { getElectionStatus, listElections } from "@/lib/queries/elections";
import { getGeographyStatus } from "@/lib/queries/geography";
import { getCd2IntelSummary } from "@/lib/queries/intelligence";
import {
  getCd2SegmentHotspots,
  getCd2SegmentSummary,
} from "@/lib/queries/voter-scorecard";
import { getVolunteersDashboardPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let intelSummary: Awaited<ReturnType<typeof getCd2IntelSummary>> | null = null;
  let intelError: string | null = null;
  try {
    intelSummary = await getCd2IntelSummary();
  } catch (e) {
    intelError = String(e);
  }

  let segmentSummary: Awaited<ReturnType<typeof getCd2SegmentSummary>> | null = null;
  let segmentHotspots: Awaited<ReturnType<typeof getCd2SegmentHotspots>> | null =
    null;
  let segmentError: string | null = null;
  try {
    [segmentSummary, segmentHotspots] = await Promise.all([
      getCd2SegmentSummary(),
      getCd2SegmentHotspots({ segment: "persuadable", limit: 15 }),
    ]);
  } catch (e) {
    segmentError = String(e);
  }

  const [
    analyticsOverview,
    powerProfiles,
    registrationGaps,
    overview,
    counties,
    status,
    geoStatus,
    censusStatus,
    censusSample,
    blsStatus,
    blsSample,
    electionStatus,
    recentElections,
    volunteerOs,
  ] = await Promise.all([
    getCountyAnalyticsOverview(),
    getCountyPowerProfiles(),
    getCountyRegistrationGaps("penetrationAsc"),
    getDashboardOverview(),
    getCountySummary(25),
    getDashboardStatus(),
    getGeographyStatus(),
    getCensusStatus(),
    getCensusCountyRows(10),
    getBlsStatus(),
    getLatestBlsCountySummary(10),
    getElectionStatus(),
    listElections(8),
    getVolunteersDashboardPayload(),
  ]);

  return (
    <PageShell>
      <PageHero
        eyebrow="Kelly Grappe for Arkansas Secretary of State"
        title="Civic engagement command center"
        description="People over politics—steady, transparent administration. County-level registration vs Census voting-age population, initiative signals, turnout gaps, and scenario planning."
        pills={
          <>
            <StatusPill tone={overview.databaseOnline ? "success" : "danger"}>
              {overview.databaseOnline ? "Database Online" : "Database Offline"}
            </StatusPill>
            <StatusPill tone="neutral">Protect the vote</StatusPill>
            <StatusPill tone="neutral">Serve all 75 counties</StatusPill>
            <StatusPill tone="neutral">Transparency</StatusPill>
          </>
        }
      />

        <AnalyticsOverviewCards analytics={analyticsOverview} />

        <SectionCard
          title="Volunteer OS"
          description="Recruit, activate, retain, and grow leaders. Launches from the main dashboard so the whole system stays cohesive."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={volunteerOs.readiness.ready ? "success" : "neutral"}>
                {volunteerOs.readiness.ready ? "Ready" : "Setup needed"}
              </StatusPill>
              <StatusPill tone="neutral">
                Total {volunteerOs.metrics.totalVolunteers ?? "—"}
              </StatusPill>
              <StatusPill tone="neutral">
                Active {volunteerOs.metrics.activeVolunteers ?? "—"}
              </StatusPill>
              <StatusPill tone="neutral">
                New (7d) {volunteerOs.metrics.newVolunteers7d ?? "—"}
              </StatusPill>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/volunteers/dashboard"
                className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
              >
                Open Volunteer OS
              </Link>
              <Link
                href="/volunteers/list"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                View volunteers
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Field App"
          description="Mobile canvassing workbench — extremely fast, thumb-first, and resilient in weak service. The hand in the field."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="neutral">Mobile-first</StatusPill>
              <StatusPill tone="neutral">Offline-friendly (next)</StatusPill>
              <StatusPill tone="neutral">One-tap outcomes</StatusPill>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/field/mobile/login"
                className="rounded-2xl border border-sky-400/25 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
              >
                Open Field App
              </Link>
              <Link
                href="/field/mobile/turf"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Turf list
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="CM Hub"
          description="The brain: command + reporting + coordination + escalation. Every dashboard feeds into one place."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="neutral">Role-based dashboards</StatusPill>
              <StatusPill tone="neutral">Workflows (tasks + deps)</StatusPill>
              <StatusPill tone="neutral">Reports Agent</StatusPill>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/cm-hub"
                className="rounded-2xl border border-violet-400/25 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/20"
              >
                Open CM Hub
              </Link>
              <Link
                href="/cm-hub/workflows"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Workflows
              </Link>
            </div>
          </div>
        </SectionCard>

        <IntelligenceCommandPanel summary={intelSummary} error={intelError} />

        <VoterSegmentPanel
          segments={segmentSummary}
          hotspots={segmentHotspots}
          error={segmentError}
        />

        <CountyPowerProfileTable rows={powerProfiles} />

        <RegistrationGapPanel gaps={registrationGaps} />

        <OverviewCards overview={overview} />

        <SectionCard
          title="Reference & external layers"
          description="Geography seed, Census ACS, BLS LAUS, and election imports. Each layer degrades gracefully if SQL migrations are not applied yet."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusPill tone={geoStatus.countyCount >= 75 ? "success" : "neutral"}>
              Geo counties {geoStatus.countyCount}
            </StatusPill>
            <StatusPill tone="neutral">Precincts {geoStatus.precinctCount}</StatusPill>
            <StatusPill tone="neutral">Aliases {geoStatus.aliasCount}</StatusPill>
            <StatusPill tone="neutral">
              Crosswalk pending {geoStatus.crosswalkPendingSuggestions}
            </StatusPill>
            <StatusPill tone={geoStatus.crosswalkExceptions > 0 ? "neutral" : "success"}>
              Crosswalk exceptions {geoStatus.crosswalkExceptions}
            </StatusPill>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <CensusSummaryPanel status={censusStatus} sampleCounties={censusSample} />
            <BlsSummaryPanel status={blsStatus} sampleCounties={blsSample} />
            <ElectionSummaryPanel status={electionStatus} recentElections={recentElections} />
          </div>
        </SectionCard>

        <section className="grid gap-6 xl:grid-cols-[1.55fr_420px]">
          <SectionCard
            title="County voter footprint"
            description="Live county counts from raw_vr. This is the first operational table in the campaign command center."
          >
            <CountySummaryTable rows={counties} />
          </SectionCard>

          <div className="flex flex-col gap-6">
            <DataStatusPanel overview={overview} status={status} />
            <AskPanel />
            <SectionCard
              title="Simulation bay"
              description="Reserved for turnout, persuasion, and county mix simulations."
            >
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-4">
                  <p className="font-medium text-white">Coming next</p>
                  <p className="mt-1 text-slate-400">
                    Scenario modeling for turnout shifts, demographic lift, county mix changes,
                    and statewide vote target planning.
                  </p>
                </div>
                <ul className="space-y-2 text-slate-400">
                  <li>• Simulate +3% turnout in target counties</li>
                  <li>• Estimate persuasion vs turnout paths</li>
                  <li>• Compare county mix scenarios</li>
                </ul>
              </div>
            </SectionCard>
          </div>
        </section>
    </PageShell>
  );
}
