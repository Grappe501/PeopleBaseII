import { SectionCard } from "@/components/dashboard/section-card";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { listUpcomingEvents } from "@/lib/queries/events";
import { EventEntryPanel } from "@/components/command-center/event-entry-panel";
import { ApprovalQueuePanel } from "@/components/command-center/approval-queue-panel";

export const dynamic = "force-dynamic";

export default async function CommandCenterCalendarPage() {
  const events = await listUpcomingEvents({ level: "statewide", limit: 25 });

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Calendar command center"
        description="Create events as drafts, submit for review, approve to publish into upstream calendars."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Workflow</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>
                <span className="font-medium text-white">draft</span> →{" "}
                <span className="font-medium text-white">in_review</span> →{" "}
                <span className="font-medium text-white">approved</span> → rolls up
              </li>
              <li>
                <span className="font-medium text-white">rejected</span> requires reason
              </li>
              <li>
                Only <span className="font-medium text-white">approved</span> events appear on the
                public calendars
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Personal calendars</p>
            <p className="mt-3 text-sm text-slate-300">
              ICS downloads are available per event via the API. Next step: add Google OAuth in
              Settings (user-provided credentials; no hardcoding).
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
          Event creation + approvals are available via local-only API routes:
          <code className="ml-2 rounded bg-white/10 px-1">/api/command-center/events</code>
          <span className="text-slate-500">
            {" "}
            (UI form + approval queue panel comes next)
          </span>
          .
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <EventEntryPanel />
        <ApprovalQueuePanel />
      </div>

      <CalendarPanel
        title="Approved upcoming events (statewide view)"
        description="Only approved + published events show here."
        events={events}
      />
    </div>
  );
}

