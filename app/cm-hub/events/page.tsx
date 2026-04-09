import { SectionCard } from "@/components/dashboard/section-card";

export const dynamic = "force-dynamic";

export default function EventsLeadDashboard() {
  return (
    <SectionCard
      title="Events dashboard"
      description="Upcoming events, staffing, RSVP→attendance, supplies, follow-up. (Scaffold — staffing view next.)"
    >
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Coming next: event staffing coverage + approvals integrated with command center events.
      </div>
    </SectionCard>
  );
}

