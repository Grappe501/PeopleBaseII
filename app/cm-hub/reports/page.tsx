import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <SectionCard
      title="Reports"
      description="Quick access to operational reports. Use the Reports Agent panel to run reports from any dashboard."
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: curated report shortcuts + exports.
      </div>
    </SectionCard>
  );
}

