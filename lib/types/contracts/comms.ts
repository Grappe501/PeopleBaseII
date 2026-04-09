export type CommsTemplateRow = {
  id: number;
  templateKey: string;
  name: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
  isActive: boolean;
};

export type CommsQueueRow = {
  id: number;
  createdAt: string;
  personId: string;
  channel: "email" | "sms";
  templateKey: string | null;
  subject: string | null;
  body: string;
  status: string;
  complianceMessageLogId: number | null;
  blockReason: string | null;
  /** When set, this queue row was created by messaging orchestration. */
  messagingJourneyId?: string | null;
  messagingJourneyStepId?: number | null;
};

export type CommsQueueListPayload = {
  rows: CommsQueueRow[];
};

export type CommsTemplatesListPayload = {
  rows: CommsTemplateRow[];
};
