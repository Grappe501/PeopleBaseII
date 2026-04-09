import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function SocialDashboard() {
  return (
    <SectionCard
      title="Social dashboard"
      description="Posts scheduled, engagement, content gaps, recommendations. (Scaffold — planner next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: content calendar + approvals.
      </div>
    </SectionCard>
  );
}

