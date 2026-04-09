import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default function FieldSyncPage() {
  return (
    <>
      <MobileTopBar title="Sync" left={<span className="text-xs text-slate-400">Status</span>} right={<span className="text-xs text-emerald-300/90">Synced</span>} />
      <div className="space-y-3 px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Offline-ready (coming next)
          </p>
          <p className="mt-2 text-sm text-slate-300">
            This screen will show pending uploads, last successful sync, and retry for failed items.
          </p>
          <button className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
            Retry sync
          </button>
        </div>
      </div>
    </>
  );
}

