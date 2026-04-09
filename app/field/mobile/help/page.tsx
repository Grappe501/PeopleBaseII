import Link from "next/link";
import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default function FieldHelpPage() {
  return (
    <>
      <MobileTopBar title="Help" left={<span className="text-xs text-slate-400">Field App</span>} right={<span className="text-xs text-slate-400">—</span>} />
      <div className="space-y-3 px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Quick rules
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Keep it respectful and short.</li>
            <li>Tap the outcome first; add notes only when needed.</li>
            <li>If signal is weak, keep working — sync later.</li>
            <li>Flag bad addresses and data issues clearly.</li>
          </ul>
          <Link
            href="/field/mobile/home"
            className="mt-5 inline-block rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Back
          </Link>
        </div>
      </div>
    </>
  );
}

