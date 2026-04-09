import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function AsstCmDashboard() {
  return (
    <SectionCard
      title="Assistant CM dashboard"
      description="Execution, coordination, follow-through. (Scaffold — dependencies + escalations next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: overdue tasks, cross-team dependencies, staffing gaps, escalation queue.
      </div>
    </SectionCard>
  );
}

