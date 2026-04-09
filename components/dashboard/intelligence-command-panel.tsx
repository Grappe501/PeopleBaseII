import type { Cd2IntelSummary } from "@/lib/types/intelligence";

type Props = {
  summary: Cd2IntelSummary | null;
  error?: string | null;
};

export function IntelligenceCommandPanel({ summary, error }: Props) {
  return (
    <section className="rounded-[26px] border border-emerald-500/20 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
            Intelligence layer
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            CD2 model vs vote + blank density
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            County residuals use ACS + BLS LAUS in a transparent linear model vs 2024 presidential
            results. Precinct view estimates latent Dem share where precincts trail the county
            demographic prior.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <a
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center font-medium text-white transition hover:bg-white/10"
            href="/api/intelligence/cd2/county?format=csv"
          >
            Download county CSV
          </a>
          <a
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center font-medium text-white transition hover:bg-white/10"
            href="/api/intelligence/cd2/precincts?format=csv&limit=500"
          >
            Download precinct CSV
          </a>
          <a
            className="text-center text-xs text-sky-400/90 underline hover:text-sky-300"
            href="/api/intelligence/cd2/summary"
          >
            Raw JSON summary
          </a>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-200/90">
          Intelligence views unavailable ({error}). Apply migration{" "}
          <code className="rounded bg-white/10 px-1">120_cd2_intelligence_layer.sql</code>.
        </p>
      ) : !summary ? (
        <p className="text-sm text-slate-400">Loading intelligence summary failed.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              County coverage
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {summary.stats.cd2CountyCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              CD2 counties in model.{" "}
              <span className="text-amber-200/90">
                {summary.stats.countiesUnderperformingModel} underperforming vs model
              </span>
              .
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {summary.counties.slice(0, 6).map((c) => (
                <li key={String(c.countyId)} className="flex justify-between gap-2">
                  <span>{c.countyName}</span>
                  <span className="text-slate-500">
                    Δ {c.countyDemResidualPct?.toFixed(1) ?? "—"} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Top blank-density precincts
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {summary.topPrecinctsByBlankDensity.map((p) => (
                <li
                  key={`${p.countyId}-${p.precinctLabel}`}
                  className="border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between gap-2 font-medium text-white">
                    <span>
                      {p.countyName} · {p.precinctLabel}
                    </span>
                    <span className="text-emerald-300/90">
                      {p.blankDensityScore?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.voterModelArchetype?.replaceAll("_", " ")} · headroom{" "}
                    {p.precinctHeadroomToModelPct?.toFixed(1) ?? "—"} pts
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
