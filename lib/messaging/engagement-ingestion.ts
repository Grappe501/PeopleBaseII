import { processBranchingOnEngagement } from "@/lib/messaging/branch-processor";
import type { MessagingEngagementEventType } from "@/lib/messaging/branch-condition";
import {
  getComplianceLogById,
  getJourneyContextFromComplianceLog,
  insertMessagingEngagementEvent,
} from "@/lib/queries/messaging-engagement";

/**
 * Persist an engagement signal and evaluate waiting_branch enrollments (then path).
 */
export async function ingestEngagementFromComplianceLog(input: {
  logId: number;
  eventType: MessagingEngagementEventType;
  channel: "email" | "sms";
  payload?: Record<string, unknown>;
}): Promise<void> {
  const log = await getComplianceLogById(input.logId);
  if (!log?.personId) return;
  const ctx = await getJourneyContextFromComplianceLog(input.logId);
  await insertMessagingEngagementEvent({
    personId: log.personId,
    journeyId: ctx?.journeyId ?? null,
    enrollmentId: null,
    journeyStepId: ctx?.stepId ?? null,
    complianceMessageLogId: input.logId,
    commsQueueId: ctx?.queueId ?? null,
    channel: input.channel === "email" ? "email" : "sms",
    eventType: input.eventType,
    payload: input.payload ?? {},
  });
  await processBranchingOnEngagement({
    personId: log.personId,
    complianceMessageLogId: input.logId,
    eventType: input.eventType,
    occurredAt: new Date(),
  });
}
