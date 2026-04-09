import Link from "next/link";
import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default async function TurfOverviewPage({
  params,
}: {
  params: Promise<{ turfId: string }>;
}) {
  const { turfId } = await params;
  return (
    <>
      <MobileTopBar title="Turf" left={<span className="text-xs text-slate-400">Overview</span>} right={<span className="text-xs text-emerald-300/90">Synced</span>} />
      <div className="space-y-4 px-4 py-5">
        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Turf</p>
          <p className="mt-1 text-xl font-semibold text-white">{turfId}</p>
          <p className="mt-2 text-sm text-slate-300">48 doors • Estimated 90 min • Starting point coming next</p>
          <div className="mt-4 grid gap-3">
            <Link
              href={`/field/mobile/turf/${turfId}/live`}
              className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-3 text-center text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Start canvassing
            </Link>
            <Link
              href={`/field/mobile/turf/${turfId}/map`}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
            >
              Open map
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Script</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Hi — I’m volunteering locally. Do you have a minute for a quick question about what you want to see improved in Arkansas elections administration?
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Reminder: prioritize data quality, keep it respectful, and keep it fast.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            AI briefing (coming next)
          </p>
          <p className="mt-2 text-sm text-slate-300">
            “Best time window, not-home patterns, repeat contacts, and quick coaching tips will appear here.”
          </p>
        </section>
      </div>
    </>
  );
}

