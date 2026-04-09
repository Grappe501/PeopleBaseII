import { SectionCard } from "@/components/dashboard/section-card";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { listUpcomingEvents } from "@/lib/queries/events";
import { EventEntryPanel } from "@/components/command-center/event-entry-panel";
import { ApprovalQueuePanel } from "@/components/command-center/approval-queue-panel";
import { DataReadinessBanner } from "@/components/site/data-readiness-banner";
import { CreateWorkflowTaskButton } from "@/components/cm-hub/create-workflow-task-button";

export const dynamic = "force-dynamic";

export default async function CommandCenterCalendarPage() {
  const events = await listUpcomingEvents({ level: "statewide", limit: 25 });

  return (
    <div className="flex flex-col gap-6">
      <DataReadinessBanner
        tone="neutral"
        title="Calendar command center"
        details="Create a draft → submit for review → approve to publish. Approved events roll up upstream (place → county → statewide)."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <EventEntryPanel />
        <ApprovalQueuePanel />
      </div>

      <CalendarPanel
        title="Approved upcoming events (statewide view)"
        description="Only approved + published events show here."
        events={events}
        actionsForEvent={(e) => (
          <CreateWorkflowTaskButton
            label="Task"
            defaultTitle={`[Statewide] Event: ${e.title}`}
            eventId={e.eventId}
            defaultDepartment="events"
            defaultPriority="medium"
          />
        )}
      />
    </div>
  );
}

