import type { PersonChannelCompliance } from "@/lib/types/compliance";

export type PersonCompliancePayload = {
  personId: string;
  channels: PersonChannelCompliance[];
};

export type UpsertSuppressionInput = {
  personId: string;
  channel: "email" | "sms" | "phone" | "mail";
  suppressionReason: string;
  note?: string | null;
  endsAt?: string | null;
};

export type AddConsentEventInput = {
  personId: string;
  channel: "email" | "sms" | "phone" | "mail";
  contactType: "email" | "phone";
  contactValue?: string | null;
  consentStatus: "granted" | "denied" | "unknown";
  source?: string | null;
  evidence?: string | null;
  occurredAt?: string | null;
};

