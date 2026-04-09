import {
  listJourneySteps,
  updateEnrollment,
} from "@/lib/queries/messaging-orchestration";
import type { MessagingJourneyStepRow } from "@/lib/types/contracts/messaging-orchestration";

export function addDelay(unit: string | null, value: number | null): number {
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

export function delayBeforeRunningStep(step: MessagingJourneyStepRow | undefined): number {
  if (!step) return 0;
  return addDelay(step.delayAfterPreviousUnit, step.delayAfterPreviousValue);
}

/** Move enrollment to the next sequential step after `completedStepOrder` (linear path). */
export async function advanceAfterCompletedStep(
  enrollmentId: number,
  journeyId: string,
  completedStepOrder: number,
): Promise<void> {
  const steps = await listJourneySteps(journeyId);
  const next = steps.find((s) => s.stepOrder === completedStepOrder + 1);
  if (!next) {
    await updateEnrollment(enrollmentId, {
      status: "completed",
      lastStepAt: new Date(),
      nextStepAt: new Date(Date.now() + 10 * 365 * 86_400_000),
    });
    return;
  }
  const waitMs = delayBeforeRunningStep(next);
  await updateEnrollment(enrollmentId, {
    currentStepOrder: next.stepOrder,
    lastStepAt: new Date(),
    nextStepAt: new Date(Date.now() + waitMs),
  });
}

/** Jump to an arbitrary step order (used by branching). Clears `branchWait` from metadata. */
export async function jumpToStepOrder(
  enrollmentId: number,
  journeyId: string,
  targetStepOrder: number,
  metadataBase: Record<string, unknown>,
): Promise<void> {
  const steps = await listJourneySteps(journeyId);
  const target = steps.find((s) => s.stepOrder === targetStepOrder);
  if (!target) {
    await updateEnrollment(enrollmentId, {
      status: "completed",
      lastStepAt: new Date(),
      nextStepAt: new Date(Date.now() + 10 * 365 * 86_400_000),
      metadata: stripBranchWaitMetadata(metadataBase),
    });
    return;
  }
  const waitMs = delayBeforeRunningStep(target);
  const meta = stripBranchWaitMetadata(metadataBase);
  await updateEnrollment(enrollmentId, {
    currentStepOrder: targetStepOrder,
    status: "active",
    lastStepAt: new Date(),
    nextStepAt: new Date(Date.now() + waitMs),
    metadata: meta,
  });
}

export function stripBranchWaitMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const { branchWait: _b, ...rest } = meta;
  return rest;
}
