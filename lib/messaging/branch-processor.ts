import type { BranchConditionV1, BranchWatchKind, MessagingEngagementEventType } from "@/lib/messaging/branch-condition";
import { parseBranchCondition, watchMatchesEvent } from "@/lib/messaging/branch-condition";
import { jumpToStepOrder, stripBranchWaitMetadata } from "@/lib/messaging/journey-schedule";
import { listWaitingBranchEnrollmentsForPerson } from "@/lib/queries/messaging-engagement";
import {
  getMessagingEnrollment,
  logJourneyCompliance,
  updateEnrollment,
} from "@/lib/queries/messaging-orchestration";
import type { MessagingJourneyStepRow } from "@/lib/types/contracts/messaging-orchestration";

/** Persisted under enrollment.metadata.branchWait while status = waiting_branch. */
export type BranchWaitState = {
  conditionStepId: number;
  conditionStepOrder: number;
  watch: BranchWatchKind;
  thenStepOrder: number;
  elseStepOrder: number;
  windowStart: string;
  deadline: string;
  anchorLogId: number | null;
};

function parseBranchWait(meta: Record<string, unknown>): BranchWaitState | null {
  const bw = meta.branchWait;
  if (!bw || typeof bw !== "object") return null;
  const o = bw as Record<string, unknown>;
  if (typeof o.conditionStepId !== "number") return null;
  if (typeof o.conditionStepOrder !== "number") return null;
  if (typeof o.watch !== "string") return null;
  if (typeof o.thenStepOrder !== "number" || typeof o.elseStepOrder !== "number") return null;
  if (typeof o.windowStart !== "string" || typeof o.deadline !== "string") return null;
  return {
    conditionStepId: o.conditionStepId,
    conditionStepOrder: o.conditionStepOrder,
    watch: o.watch as BranchWatchKind,
    thenStepOrder: o.thenStepOrder,
    elseStepOrder: o.elseStepOrder,
    windowStart: o.windowStart,
    deadline: o.deadline,
    anchorLogId: typeof o.anchorLogId === "number" ? o.anchorLogId : null,
  };
}

function eventMatchesAnchor(
  eventLogId: number,
  anchorLogId: number | null,
  watch: BranchWatchKind,
): boolean {
  if (watch === "any_delivered") return true;
  if (anchorLogId == null) return true;
  return eventLogId === anchorLogId;
}

/**
 * Enter branch wait: set status waiting_branch and deadline = window end.
 * Window start uses last send when anchor is previous_send (default if lastSendLogId exists).
 */
export async function enterBranchWait(input: {
  enrollmentId: number;
  journeyId: string;
  step: MessagingJourneyStepRow;
  enrollmentMetadata: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cond = parseBranchCondition(input.step.conditionLogic);
  if (!cond) {
    return { ok: false, error: "invalid_or_missing_condition_logic" };
  }
  const meta = input.enrollmentMetadata;
  const lastSendLogId = typeof meta.lastSendLogId === "number" ? meta.lastSendLogId : null;
  const lastSendAt = typeof meta.lastSendAt === "string" ? meta.lastSendAt : null;

  const anchor: BranchConditionV1["anchor"] =
    cond.anchor ?? (lastSendLogId != null && lastSendAt ? "previous_send" : "condition_entered");

  const windowStart =
    anchor === "previous_send" && lastSendAt ? new Date(lastSendAt) : new Date();
  const deadline = new Date(windowStart.getTime() + cond.within_hours * 3_600_000);
  const anchorLogId = anchor === "previous_send" ? lastSendLogId : null;

  const branchWait: BranchWaitState = {
    conditionStepId: input.step.id,
    conditionStepOrder: input.step.stepOrder,
    watch: cond.watch,
    thenStepOrder: cond.then_step_order,
    elseStepOrder: cond.else_step_order,
    windowStart: windowStart.toISOString(),
    deadline: deadline.toISOString(),
    anchorLogId,
  };

  await updateEnrollment(input.enrollmentId, {
    status: "waiting_branch",
    nextStepAt: deadline,
    metadata: { ...meta, branchWait },
  });
  return { ok: true };
}

/** Apply else branch when deadline hits without a matching engagement event. */
export async function processBranchTimeout(enrollmentId: number, journeyId: string): Promise<void> {
  const fresh = await getMessagingEnrollment(enrollmentId);
  if (!fresh || fresh.status !== "waiting_branch") return;
  const metadata = fresh.metadata as Record<string, unknown>;
  const bw = parseBranchWait(metadata);
  if (!bw) {
    await updateEnrollment(enrollmentId, {
      status: "active",
      nextStepAt: new Date(),
      metadata: stripBranchWaitMetadata(metadata),
    });
    return;
  }
  await logJourneyCompliance({
    personId: fresh.personId,
    journeyId,
    journeyStepId: bw.conditionStepId,
    enrollmentId,
    action: "passed",
    reason: "branch_else_timeout",
    metadata: { watch: bw.watch, else_step_order: bw.elseStepOrder },
  });
  await jumpToStepOrder(enrollmentId, journeyId, bw.elseStepOrder, metadata);
}

/**
 * Called after an engagement row is stored. Resolves any matching waiting_branch enrollments (then path).
 */
export async function processBranchingOnEngagement(input: {
  personId: string;
  complianceMessageLogId: number;
  eventType: MessagingEngagementEventType;
  occurredAt: Date;
}): Promise<{ resolved: number }> {
  let resolved = 0;
  const rows = await listWaitingBranchEnrollmentsForPerson(input.personId);

  for (const row of rows) {
    const enr = await getMessagingEnrollment(row.id);
    if (!enr || enr.status !== "waiting_branch") continue;
    const bw = parseBranchWait(enr.metadata as Record<string, unknown>);
    if (!bw) continue;

    if (input.occurredAt.getTime() < new Date(bw.windowStart).getTime()) continue;
    if (input.occurredAt.getTime() > new Date(bw.deadline).getTime()) continue;
    if (!watchMatchesEvent(bw.watch, input.eventType)) continue;
    if (!eventMatchesAnchor(input.complianceMessageLogId, bw.anchorLogId, bw.watch)) continue;

    await logJourneyCompliance({
      personId: input.personId,
      journeyId: row.journeyId,
      journeyStepId: bw.conditionStepId,
      enrollmentId: row.id,
      action: "passed",
      reason: "branch_then_engagement",
      metadata: {
        watch: bw.watch,
        event_type: input.eventType,
        then_step_order: bw.thenStepOrder,
      },
    });
    await jumpToStepOrder(row.id, row.journeyId, bw.thenStepOrder, enr.metadata as Record<string, unknown>);
    resolved += 1;
  }

  return { resolved };
}
