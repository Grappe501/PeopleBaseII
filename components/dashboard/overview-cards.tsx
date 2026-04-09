import type { DashboardOverview } from "@/lib/types/dashboard";
import { StatusPill } from "./status-pill";

type Props = {
  overview: DashboardOverview;
};

const cardClass =
  "rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/20 backdrop-blur";

export function OverviewCards({ overview }: Props) {
  const cards = [
    {
      label: "Raw VR rows",
      value: overview.totalRawVrRows.toLocaleString(),
      note: "Direct count from raw_vr",
    },
    {
      label: "Counties represented",
      value: overview.countyCount.toLocaleString(),
      note: "Distinct county values found",
    },
    {
      label: "Last import timestamp",
      value: overview.lastImportedAt ?? "Not yet available",
      note: "Most recent timestamp in raw_vr",
    },
    {
      label: "Database time",
      value: overview.databaseTime ?? "Unavailable",
      note: "Live heartbeat from Postgres",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-400">{card.label}</p>
            <StatusPill tone={overview.databaseOnline ? "success" : "danger"}>
              {overview.databaseOnline ? "Live" : "Offline"}
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
