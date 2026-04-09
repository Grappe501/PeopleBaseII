import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function FundraisingDashboard() {
  return (
    <SectionCard
      title="Fundraising dashboard"
      description="Pace, pipeline, major donors, conversions. (Scaffold — finance data next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: donor pipeline + weekly pace once fundraising data layer is defined.
      </div>
    </SectionCard>
  );
}

