import type {
  Cd2SegmentHotspotRow,
  Cd2SegmentSummaryRow,
} from "@/lib/types/voter-scorecard";

type Props = {
  segments: Cd2SegmentSummaryRow[] | null;
  hotspots: Cd2SegmentHotspotRow[] | null;
  error?: string | null;
};

const SEGMENT_LABEL: Record<string, string> = {
  heavy_dem_supporter: "Heavy Dem + engaged",
  volunteer_potential: "Volunteer potential (2+ initiatives)",
  mobilization_target: "Mobilization (lean Dem, no VH)",
  persuadable: "Persuadable (swing precinct)",
  on_the_bubble: "On the bubble",
  base_pool: "Base pool",
};

export function VoterSegmentPanel({ segments, hotspots, error }: Props) {
  return (
    <section className="rounded-[26px] border border-violet-500/20 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300/90">
            CD2 voter scorecard
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Initiatives + lean + turnout signals → segments
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Every CD2 registrant gets a{" "}
            <code className="rounded bg-white/10 px-1">campaign_engagement_score</code>{" "}
            blending party+pct Dem lean, initiative breadth, vote history, and precinct
            initiative context.{" "}
            <code className="rounded bg-white/10 px-1">funder_potential_proxy_score</code>{" "}
            stands in until donor APIs / list uploads land. Multi-CD and 200k-per-district
            caps are a scale-out step on the same views.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <a
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center font-medium text-white transition hover:bg-white/10"
            href="/api/intelligence/cd2/voters/scorecard?format=csv&limit=2000"
          >
            Download scorecard CSV
          </a>
          <a
            className="text-center text-xs text-sky-400/90 underline hover:text-sky-300"
            href="/api/intelligence/cd2/segments/summary"
          >
            Raw segment counts (JSON)
          </a>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-200/90">
          Scorecard unavailable ({error}). Apply{" "}
          <code className="rounded bg-white/10 px-1">121_cd2_voter_scorecard.sql</code>.
        </p>
      ) : !segments || !hotspots ? (
        <p className="text-sm text-slate-400">No segment data.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Segment distribution
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {segments.map((s) => (
                <li
                  key={s.segmentBucket}
                  className="flex justify-between gap-2 border-b border-white/5 py-1 last:border-0"
                >
                  <span className="text-slate-300">
                    {SEGMENT_LABEL[s.segmentBucket] ?? s.segmentBucket}
                  </span>
                  <span className="font-medium text-white">
                    {s.voterCount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Where persuadable voters concentrate (precinct hotspots)
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {hotspots.slice(0, 10).map((h) => (
                <li
                  key={`${h.countyId}-${h.precinctLabel}`}
                  className="border-b border-white/5 pb-2 last:border-0"
                >
                  <div className="flex justify-between gap-2 text-white">
                    <span>
                      {h.countyName} · {h.precinctLabel}
                    </span>
                    <span>{h.voterCount.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    ~{h.segmentSharePer1kRegistrants?.toFixed(1) ?? "—"} per 1k registrants
                    in precinct
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
