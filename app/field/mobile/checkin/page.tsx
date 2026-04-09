import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default function FieldCheckInPage() {
  return (
    <>
      <MobileTopBar title="Check-in" left={<span className="text-xs text-slate-400">Shift</span>} right={<span className="text-xs text-slate-400">—</span>} />
      <div className="space-y-3 px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Safety + accountability
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Coming next: shift check-in/check-out tied to canvass sessions.
          </p>
          <button className="mt-4 w-full rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
            Check in
          </button>
          <button className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
            Check out
          </button>
        </div>
      </div>
    </>
  );
}

