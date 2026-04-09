import { SectionCard } from "@/components/dashboard/section-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CmDashboard() {
  return (
    <SectionCard
      title="Campaign Manager dashboard"
      description="Strategy, performance, accountability. (Scaffold — metrics/tasks/reports wiring next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: statewide county health, department scorecards, decision log, goals vs progress.
        <div className="mt-4">
          <Link className="text-sm font-semibold text-sky-200 hover:underline" href="/cm-hub/cm/onboarding">
            CM Agent onboarding →
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}

