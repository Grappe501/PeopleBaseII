import { SectionCard } from "@/components/dashboard/section-card";
import { WorkflowsClient } from "@/app/cm-hub/workflows/workflows-client";

export const dynamic = "force-dynamic";

export default function WorkflowsPage() {
  return (
    <SectionCard
      title="Workflows"
      description="Asana-style boards with dependencies. Tasks can link to counties, volunteers, and turfs."
    >
      <WorkflowsClient />
    </SectionCard>
  );
}

