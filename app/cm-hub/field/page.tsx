import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function FieldManagerDashboard() {
  return (
    <SectionCard
      title="Field Manager dashboard"
      description="Turfs, doors, conversations, staffing, data quality. (Scaffold — field metrics next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: assigned/completed turfs, conversations logged, data quality alerts, top precinct focus.
      </div>
    </SectionCard>
  );
}

