import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function DataIntelDashboard() {
  return (
    <SectionCard
      title="Data & Intelligence dashboard"
      description="County priority, precinct opportunity, turnout/registration gaps, data health. (Scaffold — widgets next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: embed county rankings, precinct opportunity, and coverage checks.
      </div>
    </SectionCard>
  );
}

