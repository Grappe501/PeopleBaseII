/**
 * Messaging orchestration: journeys, sequences, compliance, and event-based branching.
 */

import { canSendOutbound } from "@/lib/compliance/outreach-eligibility";
import { enterBranchWait, processBranchTimeout } from "@/lib/messaging/branch-processor";
import { advanceAfterCompletedStep } from "@/lib/messaging/journey-schedule";
import {
  approveCommsQueue,
  createCommsQueueDraft,
  getCommsQueueItem,
  getTemplateByKey,
  mergeTemplateForPerson,
  sendCommsQueueItem,
  submitCommsQueue,
} from "@/lib/queries/comms";
import {
  bumpJourneyMetricsDaily,
  bumpStepMetricsDaily,
  listDueEnrollments,
  listJourneySteps,
  logJourneyCompliance,
  updateEnrollment,
} from "@/lib/queries/messaging-orchestration";
import type {
  MessagingJourneyStepRow,
  OrchestratorTickResult,
} from "@/lib/types/contracts/messaging-orchestration";

function addDelay(unit: string | null, value: number | null): number {
  if (unit == null || value == null || value <= 0) return 0;
  switch (unit) {
    case "minute":
      return value * 60_000;
    case "hour":
      return value * 3_600_000;
    case "day":
      return value * 86_400_000;
    default:
      return 0;
  }
}

function delayBeforeRunningStep(step: MessagingJourneyStepRow | undefined): number {
  if (!step) return 0;
  return addDelay(step.delayAfterPreviousUnit, step.delayAfterPreviousValue);
}

type EnrollmentMeta = { pendingQueueId?: number };

export async function runMessagingOrchestratorTick(): Promise<OrchestratorTickResult> {
  const result: OrchestratorTickResult = {
    processed: 0,
    advanced: 0,
    blocked: 0,
    skipped: 0,
    errors: [],
    branchElseResolved: 0,
  };

  const due = await listDueEnrollments(80);
  for (const { enrollment } of due) {
    result.processed += 1;
    try {
      if (enrollment.status === "waiting_branch") {
        await processBranchTimeout(enrollment.id, enrollment.journeyId);
        result.branchElseResolved += 1;
        result.advanced += 1;
        continue;
      }

      const steps = await listJourneySteps(enrollment.journeyId);
      const step = steps.find((s) => s.stepOrder === enrollment.currentStepOrder);
      if (!step) {
        await updateEnrollment(enrollment.id, {
          status: "completed",
          lastStepAt: new Date(),
          nextStepAt: new Date(Date.now() + 10 * 365 * 86_400_000),
        });
        result.advanced += 1;
        continue;
      }

      const meta = enrollment.metadata as EnrollmentMeta;

      if (meta.pendingQueueId != null) {
        const q = await getCommsQueueItem(meta.pendingQueueId);
        if (!q) {
          await updateEnrollment(enrollment.id, {
            metadata: { ...meta, pendingQueueId: undefined },
          });
          result.skipped += 1;
          continue;
        }
        if (q.status === "sent") {
          await updateEnrollment(enrollment.id, {
            metadata: { ...meta, pendingQueueId: undefined },
          });
          await bumpStepMetricsDaily(enrollment.journeyId, step.id, "sent", 1);
          await bumpJourneyMetricsDaily(enrollment.journeyId, "sends", 1);
          if (q.complianceMessageLogId != null) {
            await updateEnrollment(enrollment.id, {
              metadata: {
                ...(enrollment.metadata as object),
                lastSendLogId: q.complianceMessageLogId,
                lastSendAt: new Date().toISOString(),
              },
            });
          }
          await advanceAfterCompletedStep(enrollment.id, enrollment.journeyId, step.stepOrder);
          result.advanced += 1;
          continue;
        }
        if (q.status === "rejected" || q.status === "blocked_compliance") {
          await logJourneyCompliance({
            personId: enrollment.personId,
            journeyId: enrollment.journeyId,
            journeyStepId: step.id,
            enrollmentId: enrollment.id,
            action: "suppressed_exit",
            channel: step.channel,
            reason: `queue_${q.status}`,
            metadata: { queueId: meta.pendingQueueId },
          });
          await updateEnrollment(enrollment.id, {
            status: "suppressed",
            metadata: { ...meta, pendingQueueId: undefined },
          });
          result.blocked += 1;
          continue;
        }
        await updateEnrollment(enrollment.id, {
          nextStepAt: new Date(Date.now() + 15 * 60_000),
        });
        result.skipped += 1;
        continue;
      }

      switch (step.stepType) {
        case "wait": {
          const pauseMs = addDelay(step.delayAfterPreviousUnit, step.delayAfterPreviousValue);
          const nextAfterWait = steps.find((s) => s.stepOrder === step.stepOrder + 1);
          const scheduleMs = pauseMs + delayBeforeRunningStep(nextAfterWait);
          await updateEnrollment(enrollment.id, {
            currentStepOrder: step.stepOrder + 1,
            lastStepAt: new Date(),
            nextStepAt: new Date(Date.now() + scheduleMs),
          });
          result.advanced += 1;
          break;
        }
        case "condition":
        case "branch": {
          const entered = await enterBranchWait({
            enrollmentId: enrollment.id,
            journeyId: enrollment.journeyId,
            step,
            enrollmentMetadata: enrollment.metadata as Record<string, unknown>,
          });
          if (!entered.ok) {
            await logJourneyCompliance({
              personId: enrollment.personId,
              journeyId: enrollment.journeyId,
              journeyStepId: step.id,
              enrollmentId: enrollment.id,
              action: "skipped",
              reason: entered.error,
              metadata: { condition: step.conditionLogic },
            });
            await advanceAfterCompletedStep(enrollment.id, enrollment.journeyId, step.stepOrder);
            result.advanced += 1;
            break;
          }
          result.advanced += 1;
          break;
        }
        case "send": {
          if (step.channel !== "email" && step.channel !== "sms") {
            await logJourneyCompliance({
              personId: enrollment.personId,
              journeyId: enrollment.journeyId,
              journeyStepId: step.id,
              enrollmentId: enrollment.id,
              action: "skipped",
              channel: step.channel,
              reason: "channel_adapter_not_wired",
            });
            result.skipped += 1;
            await advanceAfterCompletedStep(enrollment.id, enrollment.journeyId, step.stepOrder);
            result.advanced += 1;
            break;
          }

          const gate = await canSendOutbound(enrollment.personId, step.channel);
          if (!gate.ok) {
            await logJourneyCompliance({
              personId: enrollment.personId,
              journeyId: enrollment.journeyId,
              journeyStepId: step.id,
              enrollmentId: enrollment.id,
              action: "blocked",
              channel: step.channel,
              reason: gate.reason,
            });
            await bumpStepMetricsDaily(enrollment.journeyId, step.id, "blocked", 1);
            await updateEnrollment(enrollment.id, { status: "suppressed" });
            result.blocked += 1;
            break;
          }

          if (!step.templateKey?.trim()) {
            result.errors.push(`Journey step ${step.id} missing template_key.`);
            result.skipped += 1;
            break;
          }

          const template = await getTemplateByKey(step.templateKey.trim());
          if (!template) {
            result.errors.push(`Unknown template ${step.templateKey} on step ${step.id}.`);
            result.skipped += 1;
            break;
          }
          if (template.channel !== step.channel) {
            result.errors.push(`Template ${step.templateKey} channel mismatch on step ${step.id}.`);
            result.skipped += 1;
            break;
          }

          const merged = await mergeTemplateForPerson(template.body, template.subject, enrollment.personId);
          const queueId = await createCommsQueueDraft({
            personId: enrollment.personId,
            channel: step.channel,
            templateKey: step.templateKey.trim(),
            subject: merged.subject,
            body: merged.body,
            createdBy: "orchestrator",
            messagingJourneyId: enrollment.journeyId,
            messagingJourneyStepId: step.id,
          });
          if (!queueId) {
            result.errors.push(`Failed to create queue for enrollment ${enrollment.id}.`);
            break;
          }

          await bumpStepMetricsDaily(enrollment.journeyId, step.id, "attempts", 1);

          if (step.requiresApproval) {
            const submitted = await submitCommsQueue(queueId);
            if (!submitted) {
              result.errors.push(`Could not submit queue ${queueId} for approval.`);
              break;
            }
            await updateEnrollment(enrollment.id, {
              nextStepAt: new Date(Date.now() + 15 * 60_000),
              metadata: { ...(enrollment.metadata as object), pendingQueueId: queueId },
            });
            result.skipped += 1;
            break;
          }

          const approved = await approveCommsQueue(queueId, "orchestrator");
          if (!approved) {
            result.errors.push(`Could not approve queue ${queueId}.`);
            break;
          }
          const sendResult = await sendCommsQueueItem(queueId);
          if (!sendResult.ok) {
            result.errors.push(`Send failed for queue ${queueId}: ${sendResult.reason}`);
            break;
          }
          await bumpStepMetricsDaily(enrollment.journeyId, step.id, "sent", 1);
          await bumpJourneyMetricsDaily(enrollment.journeyId, "sends", 1);
          await updateEnrollment(enrollment.id, {
            metadata: {
              ...(enrollment.metadata as object),
              lastSendLogId: sendResult.complianceMessageLogId,
              lastSendAt: new Date().toISOString(),
            },
          });
          await advanceAfterCompletedStep(enrollment.id, enrollment.journeyId, step.stepOrder);
          result.advanced += 1;
          break;
        }
        default:
          result.skipped += 1;
      }
    } catch (e) {
      result.errors.push(String(e));
    }
  }

  return result;
}
