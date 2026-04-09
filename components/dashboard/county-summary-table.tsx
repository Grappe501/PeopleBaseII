import type { CountySummaryRow } from "@/lib/types/dashboard";
import { TableShell } from "@/components/site/table-shell";
import Link from "next/link";

type Props = {
  rows: CountySummaryRow[];
};

function fmtInt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(1)}%`;
}

export function CountySummaryTable({ rows }: Props) {
  const hasIntel = rows.some((r) => r.countyKey || r.countyPriorityScore != null);
  return (
    <TableShell>
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
            <tr className="text-slate-400">
              <th className="px-4 py-3 font-medium">County</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 font-medium">Expected turnout</th>
              <th className="px-4 py-3 font-medium">Reg %</th>
              <th className="px-4 py-3 font-medium">Turnout %</th>
              <th className="px-4 py-3 font-medium">New reg (Nov ’25–Nov ’26)</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Raw VR rows</th>
              <th className="px-4 py-3 font-medium">Unique IDs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  No county data available yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.county}
                  className="bg-slate-900/40 transition hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {row.countyKey ? (
                      <Link href={`/counties/${row.countyKey}`} className="hover:underline">
                        {row.county}
                      </Link>
                    ) : (
                      row.county
                    )}
                    {hasIntel ? (
                      <div className="mt-0.5 text-xs text-slate-400">
                        {row.countyKey ? `Key ${row.countyKey}` : "Raw VR-only"}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {fmtInt(row.registeredVoters ?? row.uniqueVoterCount)}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {fmtInt(row.expectedTurnoutVotes)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{fmtPct(row.registrationRatePct)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtPct(row.turnoutRatePct)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {fmtInt(row.registrationsWindowUniqueVoters)}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {row.countyPriorityScore != null ? row.countyPriorityScore.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{row.voterCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.uniqueVoterCount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
    </TableShell>
  );
}
