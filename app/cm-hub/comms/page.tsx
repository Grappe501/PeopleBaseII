import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function CommsDirectorDashboard() {
  return (
    <SectionCard
      title="Communications dashboard"
      description="Email/text performance, approvals, message calendar, segments. (Scaffold — integration next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: approvals queue + performance widgets; integrate with SendGrid/Twilio later.
      </div>
    </SectionCard>
  );
}

