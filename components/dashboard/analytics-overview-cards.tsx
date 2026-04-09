import type { CountyAnalyticsOverview } from "@/lib/types/analytics";
import { StatusPill } from "./status-pill";

type Props = {
  analytics: CountyAnalyticsOverview;
};

const cardClass =
  "rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/20 backdrop-blur";

function pct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value}%`;
}

export function AnalyticsOverviewCards({ analytics }: Props) {
  const cards = [
    {
      label: "Registered voters (county rollups)",
      value: analytics.totalRegisteredVoters.toLocaleString(),
      note: "Sum across analytics_county_registration_gap",
    },
    {
      label: "Arkansas counties",
      value: analytics.countyCount.toLocaleString(),
      note: "geo_counties for state FIPS 05",
    },
    {
      label: "Latest Census ACS year",
      value:
        analytics.latestCensusYear !== null
          ? String(analytics.latestCensusYear)
          : "—",
      note: "Max source_year in census_county_acs",
    },
    {
      label: "Avg registration penetration",
      value: pct(analytics.averageRegistrationPenetrationRate),
      note: "Mean of county rates where VAP > 0",
    },
  ];

  const live =
    analytics.countyCount > 0 &&
    (analytics.totalRegisteredVoters > 0 || analytics.latestCensusYear !== null);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-400">{card.label}</p>
            <StatusPill tone={live ? "success" : "neutral"}>
              {live ? "Analytics layer" : "Awaiting data"}
            </StatusPill>
          </div>
          <p className="mt-5 break-words text-2xl font-semibold tracking-tight text-white">
            {card.value}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{card.note}</p>
        </article>
      ))}
    </section>
  );
}
