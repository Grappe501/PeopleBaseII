import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function CandidateDashboard() {
  return (
    <SectionCard
      title="Candidate dashboard"
      description="Where to go, what to say, what matters most. (Scaffold — schedule + message packs next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: top counties to visit, key messages by county, events schedule, donor opportunities.
      </div>
    </SectionCard>
  );
}

