import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default function FieldContactsPage() {
  return (
    <>
      <MobileTopBar title="Contacts" left={<span className="text-xs text-slate-400">Queue</span>} right={<span className="text-xs text-slate-400">—</span>} />
      <div className="space-y-3 px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            My contacts
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Coming next: contacts in current turf + follow-ups due, optimized for one-tap actions.
          </p>
        </div>
      </div>
    </>
  );
}

