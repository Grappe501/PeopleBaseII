import type { BlsLausCountyRow } from "@/lib/types/bls";
import type { BlsStatus } from "@/lib/types/bls";
import { SectionCard } from "./section-card";
import { StatusPill } from "./status-pill";

type Row = BlsLausCountyRow & { countyName: string; countyKey: string };

type Props = {
  status: BlsStatus;
  sampleCounties: Row[];
};

export function BlsSummaryPanel({ status, sampleCounties }: Props) {
  return (
    <SectionCard
      title="BLS (LAUS)"
      description="Local Area Unemployment Statistics (LAUS) and QCEW annual county totals from official BLS feeds; run npm run sync:bls after migrations."
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={status.lausRowCount > 0 ? "success" : "neutral"}>
            LAUS rows {status.lausRowCount}
          </StatusPill>
          <StatusPill tone="neutral">QCEW rows {status.qcewRowCount}</StatusPill>
          <StatusPill tone="neutral">
            Latest {status.latestLausPeriod ?? "—"}
          </StatusPill>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="max-h-[220px] overflow-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                <tr className="text-slate-400">
                  <th className="px-3 py-2 font-medium">County</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">UE %</th>
                  <th className="px-3 py-2 font-medium">Labor force</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sampleCounties.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      Apply SQL migrations (including 014) and run npm run sync:bls (DATABASE_URL; BLS_API_KEY for LAUS).
                    </td>
                  </tr>
                ) : (
                  sampleCounties.map((r) => (
                    <tr
                      key={`${r.countyKey}-${r.year}-${r.month}`}
                      className="bg-slate-900/40"
                    >
                      <td className="px-3 py-2 text-white">{r.countyName}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {r.year}-{String(r.month).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {r.unemploymentRate != null ? `${r.unemploymentRate}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {r.laborForce?.toLocaleString() ?? "—"}
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
