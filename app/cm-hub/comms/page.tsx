import { SectionCard } from "@/components/dashboard/section-card";
import { CommsClient } from "./comms-client";

export const dynamic = "force-dynamic";

export default function CommsDirectorDashboard() {
  return (
    <SectionCard
      title="Communications"
      description="Templates, approval queue, compliance-gated send, and webhook inboxes (SendGrid/Twilio stubs)."
    >
      <CommsClient />
    </SectionCard>
  );
}

