import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCountyDetailByKey,
  listCountyCitiesByKey,
  listCountyPrecinctsByKey,
} from "@/lib/queries/county-pages";
import sql from "@/lib/db";
import { listUpcomingEvents } from "@/lib/queries/events";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import { TableShell } from "@/components/site/table-shell";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function fmtPct(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export default async function CountyDetailPage({
  params,
}: {
  params: Promise<{ countyKey: string }>;
}) {
  const { countyKey } = await params;

  const countyRow = await getCountyDetailByKey(countyKey);
  if (!countyRow) notFound();

  const [{ county_id: countyIdRow }] = await sql<
    { county_id: string | number }[]
  >`
    select id as county_id
    from public.geo_counties
    where county_key = ${countyKey}
    limit 1
  `;
  const countyId = countyIdRow != null ? Number(countyIdRow) : null;

  const [cities, precincts, events] = await Promise.all([
    listCountyCitiesByKey(countyKey, { limit: 75 }),
    listCountyPrecinctsByKey(countyKey, { limit: 150 }),
    countyId
      ? listUpcomingEvents({ level: "county", countyId, limit: 12 })
      : Promise.resolve([]),
  ]);

  const county = countyRow;

  return (
    <PageShell>
      <PageHero
        eyebrow="County profile"
        title={`${county.countyName} County`}
        description="Targets are correlated from statewide 600,000 scenario → county proportional share → place proportional share."
        pills={
          <>
            <StatusPill tone="neutral">Electorate {fmtInt(county.vrUniqueVoters)}</StatusPill>
            <StatusPill tone="neutral">
              Expected turnout {fmtInt(county.expectedTurnoutVotes)}
            </StatusPill>
            <StatusPill tone="neutral">Target votes {fmtInt(county.countyTargetVotes)}</StatusPill>
            <StatusPill tone="neutral">
              Priority {county.countyPriorityScore?.toFixed(1) ?? "—"}
            </StatusPill>
          </>
        }
        actions={
          <Link
            href="/counties"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            Back to counties
          </Link>
        }
      />

        <SectionCard title="County snapshot" description="Population, registration, turnout, baseline.">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Population</p>
              <p className="mt-2 text-xl font-semibold">{fmtInt(county.totalPopulation)}</p>
              <p className="mt-1 text-xs text-slate-500">VAP {fmtInt(county.votingAgePopulation)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Rates</p>
              <p className="mt-2 text-sm text-slate-300">
                Registration {fmtPct(county.registrationRatePct)}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Turnout {fmtPct(county.turnoutRatePct)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Baselines</p>
              <p className="mt-2 text-sm text-slate-300">
                2022 Gov DEM {fmtPct(county.demPct2022Governor)}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                2024 Pres DEM {fmtPct(county.demPct2024President)}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                2026 SOS DEM {fmtPct(county.demPct2026Sos)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Cities & towns (within county)"
          description="Smallest named place currently available from VR. When Census Place ACS exists, population/VAP prefer that; otherwise we show correlated estimates (county ACS ratio × city VR share)."
        >
          <TableShell>
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Place</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">VR unique</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Pop</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">VAP</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Exp turnout</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Possible Dem voters</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Target votes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                      No city/town rows found (requires `raw_vr.res_city`).
                    </td>
                  </tr>
                ) : (
                  cities.map((c) => (
                    <tr key={c.cityKey} className="bg-slate-900/40 hover:bg-slate-800/60">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                        <Link
                          className="hover:underline"
                          href={`/counties/${countyKey}/places/${c.cityKey}`}
                        >
                          {c.cityName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.cityVrUniqueVoters)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.censusPlaceTotalPopulation ?? c.cityEstimatedTotalPopulation)}
                        {c.censusPlaceTotalPopulation != null ? (
                          <span className="ml-2 text-xs text-emerald-300/80">ACS</span>
                        ) : (
                          <span className="ml-2 text-xs text-slate-500">est.</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.censusPlaceVotingAgePopulation)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.cityExpectedTurnoutVotes)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.cityPossibleDemVoters)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {fmtInt(c.cityTargetVotes)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </SectionCard>

        <SectionCard
          title="Top precincts (county)"
          description="Precinct scoring is statewide; this list is filtered to the county."
        >
          <TableShell>
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Precinct</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Registered</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Turnout %</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">2024 DEM %</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {precincts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                      No precinct rows found (requires precinct-level election imports and/or VR
                      precincts).
                    </td>
                  </tr>
                ) : (
                  precincts.slice(0, 75).map((p) => (
                    <tr
                      key={`${p.countyId}-${p.precinctLabel}`}
                      className="bg-slate-900/40 hover:bg-slate-800/60"
                    >
                      <td className="px-3 py-2 font-medium text-white">{p.precinctLabel}</td>
                      <td className="px-3 py-2 text-slate-300">{fmtInt(p.registeredVoters)}</td>
                      <td className="px-3 py-2 text-slate-300">{fmtPct(p.turnoutRatePct)}</td>
                      <td className="px-3 py-2 text-slate-300">{fmtPct(p.demPct2024President)}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {p.precinctPriorityScore != null ? p.precinctPriorityScore.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </SectionCard>

        <CalendarPanel
          title="County calendar"
          description="Includes this county’s events plus place/precinct events that roll up here."
          events={events}
        />
    </PageShell>
  );
}

