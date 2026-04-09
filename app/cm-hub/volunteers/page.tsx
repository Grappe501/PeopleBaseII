import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function VolunteerCoordinatorDashboard() {
  return (
    <SectionCard
      title="Volunteer Coordinator dashboard"
      description="Recruitment, activation, retention, leadership pipeline. (Scaffold — funnel wiring next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: onboarding pipeline, inactive re-engagement, power-of-5 growth, role coverage gaps.
      </div>
    </SectionCard>
  );
}

