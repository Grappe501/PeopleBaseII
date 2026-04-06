import type { CountySummaryRow } from "@/lib/types/dashboard";

type Props = {
  rows: CountySummaryRow[];
};

export function CountySummaryTable({ rows }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
            <tr className="text-slate-400">
              <th className="px-4 py-3 font-medium">County</th>
              <th className="px-4 py-3 font-medium">Rows</th>
              <th className="px-4 py-3 font-medium">Unique voter IDs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                  No county data available yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.county}
                  className="bg-slate-900/40 transition hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3 font-medium text-white">{row.county}</td>
                  <td className="px-4 py-3 text-slate-200">
                    {row.voterCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.uniqueVoterCount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
