import { SectionCard } from "@/components/dashboard/section-card";
import { CallTimeClient } from "@/app/cm-hub/candidate/call-time/call-time-client";

export const dynamic = "force-dynamic";

export default function CandidateCallTimePage() {
  return (
    <SectionCard
      title="Call time"
      description="AI-ranked call list with quick scripts and outcome tracking. (MVP placeholder data; GoodChange plugs in next.)"
    >
      <CallTimeClient />
    </SectionCard>
  );
}

