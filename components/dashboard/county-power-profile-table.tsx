import type { CountyPowerProfileRow } from "@/lib/types/analytics";
import { SectionCard } from "./section-card";

type Props = {
  rows: CountyPowerProfileRow[];
};

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function fmtMoney(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function CountyPowerProfileTable({ rows }: Props) {
  return (
    <SectionCard
      title="County power profiles"
      description="Registration vs voting-age population (ACS) with income and race/ethnicity totals from the latest county ACS row."
    >
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="max-h-[min(520px,70vh)] overflow-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">County</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Reg %</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">VAP</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Registered</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Med. inc.</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Poverty</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">White</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Black</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Hispanic</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Asian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-slate-400">
                    Apply sql/005_analytics_views.sql and load Census ACS + VR so
                    analytics_county_power_profile populates.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.countyName} className="bg-slate-900/40">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                      {r.countyName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {r.registrationPenetrationRate != null
                        ? `${r.registrationPenetrationRate}%`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.votingAgePopulation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.registeredVoters)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtMoney(r.medianHouseholdIncome)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.povertyPopulation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.whitePopulation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.blackPopulation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.hispanicPopulation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtInt(r.asianPopulation)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}
