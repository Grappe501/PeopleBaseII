import type { PrecinctTurnoutGapRow } from "@/lib/types/analytics";
import { SectionCard } from "./section-card";

type Props = {
  turnoutSample: PrecinctTurnoutGapRow[];
};

export function PrecinctIntelligenceTable({ turnoutSample }: Props) {
  const rows = turnoutSample.slice(0, 25);

  return (
    <SectionCard
      title="Precinct intelligence"
      description="Placeholder slice from analytics_precinct_turnout_gap. Performance by party lives in analytics_precinct_performance; wire filters and maps in a later tab."
    >
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="max-h-[280px] overflow-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
              <tr className="text-slate-400">
                <th className="px-3 py-2 font-medium">Precinct</th>
                <th className="px-3 py-2 font-medium">County</th>
                <th className="px-3 py-2 font-medium">Year</th>
                <th className="px-3 py-2 font-medium">Turnout %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    Import turnout rows into precinct_turnout to populate this view.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.precinctKey}-${r.electionYear}-${i}`} className="bg-slate-900/40">
                    <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-white">
                      {r.precinctKey}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{r.countyName}</td>
                    <td className="px-3 py-2 text-slate-300">{r.electionYear}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.turnoutRate != null ? `${r.turnoutRate}` : "—"}
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
