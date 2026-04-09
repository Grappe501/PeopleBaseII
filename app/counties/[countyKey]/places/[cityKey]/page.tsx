import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import sql from "@/lib/db";
import { listUpcomingEvents } from "@/lib/queries/events";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function CountyPlacePage({
  params,
}: {
  params: Promise<{ countyKey: string; cityKey: string }>;
}) {
  const { countyKey, cityKey } = await params;

  const rows = await sql<
    Array<{
      county_id: string | number;
      county_name: string;
      city_key: string;
      city_name: string;
      city_vr_unique_voters: string | number | null;
      city_estimated_total_population: string | number | null;
      city_estimated_voting_age_population: string | number | null;
      census_place_total_population: string | number | null;
      census_place_voting_age_population: string | number | null;
      city_expected_turnout_votes: string | number | null;
      city_possible_dem_voters: string | number | null;
      city_target_votes_at_proportional_share: string | number | null;
      county_dem_baseline_pct: string | number | null;
      county_turnout_rate_pct: string | number | null;
      county_registration_rate_pct: string | number | null;
    }>
  >`
    select *
    from public.statewide_city_master_v c
    join public.geo_counties gc on gc.id = c.county_id
    where gc.county_key = ${countyKey}
      and c.city_key = ${cityKey}
    limit 1
  `;

  const r = rows[0];
  if (!r) notFound();

  const [{ geo_city_id: geoCityIdRow }] = await sql<
    { geo_city_id: string | number | null }[]
  >`
    select gp.geo_city_id
    from public.geo_counties gc
    join public.geo_city_primary_county_v gp
      on gp.county_id = gc.id
    where gc.county_key = ${countyKey}
      and gp.city_key = ${cityKey}
    limit 1
  `;
  const geoCityId = geoCityIdRow != null ? Number(geoCityIdRow) : null;

  const events =
    geoCityId != null
      ? await listUpcomingEvents({ level: "place", geoCityId, limit: 12 })
      : [];

  return (
    <PageShell>
      <PageHero
        eyebrow="Place profile"
        title={r.city_name}
        description={`Within ${r.county_name} County. Targets are allocated proportionally from the county’s target under the statewide 600,000 scenario.`}
        pills={
          <>
            <StatusPill tone="neutral">
              VR unique{" "}
              {fmtInt(r.city_vr_unique_voters != null ? Number(r.city_vr_unique_voters) : 0)}
            </StatusPill>
            <StatusPill tone="neutral">
              Target votes{" "}
              {fmtInt(
                r.city_target_votes_at_proportional_share != null
                  ? Number(r.city_target_votes_at_proportional_share)
                  : 0,
              )}
            </StatusPill>
          </>
        }
        actions={
          <>
            <Link
              href={`/counties/${countyKey}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Back to county
            </Link>
            <Link
              href="/counties"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              All counties
            </Link>
          </>
        }
      />

        <SectionCard
          title="Place metrics"
          description="Population/VAP prefer Census Place ACS when available; otherwise fall back to correlated estimates derived from county ACS ratios and city VR counts."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">VR unique</p>
              <p className="mt-2 text-2xl font-semibold">
                {fmtInt(r.city_vr_unique_voters != null ? Number(r.city_vr_unique_voters) : 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Target votes {fmtInt(r.city_target_votes_at_proportional_share != null ? Number(r.city_target_votes_at_proportional_share) : 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Population</p>
              <p className="mt-2 text-2xl font-semibold">
                {fmtInt(
                  r.census_place_total_population != null
                    ? Number(r.census_place_total_population)
                    : r.city_estimated_total_population != null
                      ? Number(r.city_estimated_total_population)
                      : null,
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                VAP{" "}
                {fmtInt(
                  r.census_place_voting_age_population != null
                    ? Number(r.census_place_voting_age_population)
                    : r.city_estimated_voting_age_population != null
                      ? Number(r.city_estimated_voting_age_population)
                      : null,
                )}
                {r.census_place_total_population != null ? (
                  <span className="ml-2 text-emerald-300/80">ACS</span>
                ) : (
                  <span className="ml-2 text-slate-500">est.</span>
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Turnout + baseline</p>
              <p className="mt-2 text-sm text-slate-300">
                Expected turnout votes{" "}
                <span className="font-semibold text-white">
                  {fmtInt(r.city_expected_turnout_votes != null ? Number(r.city_expected_turnout_votes) : 0)}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Possible Dem voters{" "}
                <span className="font-semibold text-white">
                  {fmtInt(r.city_possible_dem_voters != null ? Number(r.city_possible_dem_voters) : 0)}
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                County baseline {r.county_dem_baseline_pct != null ? `${Number(r.county_dem_baseline_pct).toFixed(1)}%` : "—"} · County turnout {r.county_turnout_rate_pct != null ? `${Number(r.county_turnout_rate_pct).toFixed(1)}%` : "—"} · County reg {r.county_registration_rate_pct != null ? `${Number(r.county_registration_rate_pct).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </SectionCard>

        <CalendarPanel
          title="Place calendar"
          description="Includes this place’s events (and precinct events, if scoped to a precinct within this place)."
          events={events}
        />
    </PageShell>
  );
}

