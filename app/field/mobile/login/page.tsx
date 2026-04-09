import Link from "next/link";
import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default function FieldLoginPage() {
  return (
    <>
      <MobileTopBar title="Field App" right={<span className="text-xs text-slate-400">Offline</span>} />
      <div className="px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
            Volunteer OS
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Field App</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Fast, thumb-first canvassing. Built for low signal, high pace, and clean data.
          </p>
          <div className="mt-5 grid gap-3">
            <button className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10">
              Continue with Google (coming next)
            </button>
            <Link
              className="w-full rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-3 text-center text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
              href="/field/mobile/home"
            >
              Continue (dev)
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            By continuing, you agree to record field activity respectfully and protect voter privacy.
          </p>
          <Link className="mt-2 inline-block text-xs font-semibold text-sky-200 hover:underline" href="/field/mobile/help">
            Need help?
          </Link>
        </div>
      </div>
    </>
  );
}

