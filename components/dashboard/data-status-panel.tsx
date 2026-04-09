import type { DashboardOverview, DashboardStatus } from "@/lib/types/dashboard";
import { SectionCard } from "./section-card";
import { StatusPill } from "./status-pill";

type Props = {
  overview: DashboardOverview;
  status: DashboardStatus;
};

function fmt(value: number) {
  return value.toLocaleString();
}

export function DataStatusPanel({ overview, status }: Props) {
  return (
    <SectionCard
      title="Data status"
      description="Live health + coverage checks from the current VR-backed dataset."
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={overview.databaseOnline ? "success" : "danger"}>
            {overview.databaseOnline ? "DB live" : "DB offline"}
          </StatusPill>
          <StatusPill tone={status.hasCountyColumn ? "success" : "danger"}>
            {status.hasCountyColumn ? "County column found" : "County column missing"}
          </StatusPill>
          <StatusPill tone={status.hasVoterIdColumn ? "success" : "neutral"}>
            {status.hasVoterIdColumn ? "Voter ID column found" : "No voter ID column"}
          </StatusPill>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-slate-400">Rows with county</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt(status.rowsWithCounty)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-slate-400">Rows with voter ID</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt(status.rowsWithVoterId)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-slate-400">Distinct voter IDs</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt(status.distinctVoterIds)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-slate-400">Potential duplicate residue</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt(status.duplicateResidue)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-4 text-slate-300">
          <p className="font-medium text-white">Interpretation</p>
          <p className="mt-2 text-slate-400">
            This panel helps verify that your deduped VR import is stable before voter history,
            AR-02 filtering, and modeling layers are added.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
