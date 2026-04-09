import type { ElectionRow } from "@/lib/types/elections";
import type { ElectionStatus } from "@/lib/types/elections";
import { SectionCard } from "./section-card";
import { StatusPill } from "./status-pill";

type Props = {
  status: ElectionStatus;
  recentElections: ElectionRow[];
};

export function ElectionSummaryPanel({ status, recentElections }: Props) {
  return (
    <SectionCard
      title="Elections"
      description="Precinct results and turnout land in normalized tables; import via scripts/import-election-results.ts."
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={status.electionCount > 0 ? "success" : "neutral"}>
            Elections {status.electionCount}
          </StatusPill>
          <StatusPill tone="neutral">Races {status.raceCount}</StatusPill>
          <StatusPill tone="neutral">Result rows {status.precinctResultCount}</StatusPill>
          <StatusPill tone="neutral">Turnout rows {status.precinctTurnoutCount}</StatusPill>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="max-h-[200px] overflow-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                <tr className="text-slate-400">
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentElections.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                      No elections imported yet.
                    </td>
                  </tr>
                ) : (
                  recentElections.map((e) => (
                    <tr key={e.id} className="bg-slate-900/40">
                      <td className="px-3 py-2 font-mono text-xs text-white">
                        {e.electionKey}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{e.electionYear}</td>
                      <td className="px-3 py-2 text-slate-300">{e.electionType}</td>
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
