import { SectionCard } from "@/components/dashboard/section-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CandidateDashboard() {
  return (
    <SectionCard
      title="Candidate dashboard"
      description="Where to go, what to say, what matters most. (Scaffold — schedule + message packs next.)"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Start here</p>
          <p className="mt-1 text-slate-400">
            Daily operating flow: call time → events → county targets. Keep it simple and repeatable.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/cm-hub/candidate/call-time"
              className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Open call time
            </Link>
            <Link
              href="/command-center/calendar"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              View calendar
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
          Coming next: top counties to visit, key messages by county, and a compact daily briefing.
        </div>
      </div>
    </SectionCard>
  );
}

