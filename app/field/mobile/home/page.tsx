import Link from "next/link";
import { MobileTopBar } from "@/components/field/mobile-topbar";
import { HomeClient } from "@/app/field/mobile/home/home-client";

export const dynamic = "force-dynamic";

export default function FieldHomePage() {
  return (
    <>
      <MobileTopBar
        title="Home"
        left={<span className="text-xs font-semibold text-slate-300">AR Field</span>}
        right={<span className="text-xs text-emerald-300/90">Synced</span>}
      />
      <div className="space-y-4 px-4 py-5">
        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Good morning
          </p>
          <p className="mt-1 text-lg font-semibold text-white">Canvasser</p>
          <p className="mt-1 text-sm text-slate-400">Field command post • fast actions • clean data</p>
          <HomeClient />
        </section>

        <section className="grid grid-cols-3 gap-3">
          {[
            { k: "Doors", v: "—" },
            { k: "Done", v: "—" },
            { k: "Follow-ups", v: "—" },
          ].map((c) => (
            <div key={c.k} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {c.k}
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{c.v}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Best next action
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Tap fast outcomes first. If you mark “Not Home,” the app will auto-advance in the live flow.
          </p>
        </section>
      </div>
    </>
  );
}

