import { SectionCard } from "@/components/dashboard/section-card";
import { CmAgentOnboardingClient } from "@/app/cm-hub/cm/onboarding/onboarding-client";

export const dynamic = "force-dynamic";

export default function CmAgentOnboardingPage() {
  return (
    <SectionCard
      title="CM Agent onboarding"
      description="Upload/define philosophy, availability, priorities, and style so the CM agent stays synced and can coordinate every other agent consistently."
    >
      <CmAgentOnboardingClient />
    </SectionCard>
  );
}

