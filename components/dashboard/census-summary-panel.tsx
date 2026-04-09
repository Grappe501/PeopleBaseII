import type { CensusCountyAcsRow, CensusStatus } from "@/lib/types/census";
import { SectionCard } from "./section-card";
import { StatusPill } from "./status-pill";

type Row = CensusCountyAcsRow & { countyName: string; countyKey: string };

type Props = {
  status: CensusStatus;
  sampleCounties: Row[];
};

export function CensusSummaryPanel({ status, sampleCounties }: Props) {
  return (
    <SectionCard
      title="Census (ACS)"
      description="County-level American Community Survey coverage. Sync via scripts/sync-census.ts."
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={status.tableReady && status.hasData ? "success" : "neutral"}>
            {status.tableReady && status.hasData ? "Data loaded" : "No rows yet"}
          </StatusPill>
          <StatusPill tone="neutral">
            Latest year {status.latestSourceYear ?? "—"}
          </StatusPill>
          <StatusPill tone="neutral">
            Counties {status.countiesWithData}
          </StatusPill>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="max-h-[220px] overflow-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                <tr className="text-slate-400">
                  <th className="px-3 py-2 font-medium">County</th>
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Pop</th>
                  <th className="px-3 py-2 font-medium">Med. inc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sampleCounties.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      Run SQL 002 and sync-census when ready.
                    </td>
                  </tr>
                ) : (
                  sampleCounties.map((r) => (
                    <tr
                      key={`${r.countyKey}-${r.sourceYear}`}
                      className="bg-slate-900/40"
                    >
                      <td className="px-3 py-2 text-white">{r.countyName}</td>
                      <td className="px-3 py-2 text-slate-300">{r.sourceYear}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {r.totalPopulation?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {r.medianHouseholdIncome != null
                          ? `$${Number(r.medianHouseholdIncome).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
