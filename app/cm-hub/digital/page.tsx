import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function DigitalDashboard() {
  return (
    <SectionCard
      title="Digital dashboard"
      description="Email+text combined, list growth, segmentation health, automation flows. (Scaffold — metrics next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: list growth + conversion metrics + A/B test tracker.
      </div>
    </SectionCard>
  );
}

