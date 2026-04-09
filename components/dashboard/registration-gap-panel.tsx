import type { CountyRegistrationGapRow } from "@/lib/types/analytics";
import { SectionCard } from "./section-card";

type Props = {
  gaps: CountyRegistrationGapRow[];
};

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export function RegistrationGapPanel({ gaps }: Props) {
  const slice = gaps.slice(0, 25);

  return (
    <SectionCard
      title="Registration gaps"
      description="Counties with the lowest registration penetration (registered voters divided by ACS voting-age population), weakest first."
    >
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
              <tr className="text-slate-400">
                <th className="px-3 py-2 font-medium">County</th>
                <th className="px-3 py-2 font-medium">Penetration</th>
                <th className="px-3 py-2 font-medium">Registered</th>
                <th className="px-3 py-2 font-medium">VAP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    No gap rows yet. Ensure Census ACS county rows and VR county joins are loaded.
                  </td>
                </tr>
              ) : (
                slice.map((g) => (
                  <tr key={g.countyName} className="bg-slate-900/40">
                    <td className="px-3 py-2 font-medium text-white">{g.countyName}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {g.registrationPenetrationRate != null
                        ? `${g.registrationPenetrationRate}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {g.registeredVoters.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {fmtInt(g.votingAgePopulation)}
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
