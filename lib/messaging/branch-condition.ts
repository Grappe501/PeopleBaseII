import type { JsonObject } from "@/lib/types/contracts/json";

/** Supported `condition_logic` / `branch` step JSON (v1). */
export type BranchConditionV1 = {
  watch: BranchWatchKind;
  within_hours: number;
  then_step_order: number;
  else_step_order: number;
  anchor?: "previous_send" | "condition_entered";
};

export type BranchWatchKind =
  | "email_open"
  | "email_click"
  | "email_delivered"
  | "sms_delivered"
  | "sms_reply"
  | "any_delivered";

/** Canonical event types stored in `messaging_engagement_events.event_type`. */
export type MessagingEngagementEventType =
  | "email_open"
  | "email_click"
  | "email_delivered"
  | "sms_delivered"
  | "sms_received"
  | "bounce"
  | "complaint"
  | "system";

export function parseBranchCondition(raw: JsonObject | null | undefined): BranchConditionV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const watch = raw.watch;
  const within_hours = raw.within_hours;
  const then_step_order = raw.then_step_order;
  const else_step_order = raw.else_step_order;
  if (typeof watch !== "string") return null;
  if (typeof within_hours !== "number" || within_hours <= 0 || within_hours > 24 * 365) return null;
  if (typeof then_step_order !== "number" || typeof else_step_order !== "number") return null;
  if (!isWatchKind(watch)) return null;
  const anchor = raw.anchor;
  if (anchor !== undefined && anchor !== "previous_send" && anchor !== "condition_entered") return null;
  return {
    watch: watch,
    within_hours,
    then_step_order,
    else_step_order,
    anchor: anchor === "condition_entered" ? "condition_entered" : anchor === "previous_send" ? "previous_send" : undefined,
  };
}

function isWatchKind(s: string): s is BranchWatchKind {
  return (
    s === "email_open" ||
    s === "email_click" ||
    s === "email_delivered" ||
    s === "sms_delivered" ||
    s === "sms_reply" ||
    s === "any_delivered"
  );
}

/** Whether an engagement event satisfies the branch watch. */
export function watchMatchesEvent(watch: BranchWatchKind, eventType: MessagingEngagementEventType): boolean {
  if (watch === "any_delivered") {
    return eventType === "email_delivered" || eventType === "sms_delivered";
  }
  if (watch === "sms_reply") {
    return eventType === "sms_received";
  }
  return watch === eventType;
}
