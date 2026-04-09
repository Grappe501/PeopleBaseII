import type { JsonObject } from "@/lib/types/contracts/json";

/** @see public.messaging_objectives */
export type MessagingObjectiveRow = {
  id: string;
  objectiveKey: string;
  name: string;
  description: string | null;
  createdAt: string;
};

/** @see public.messaging_journeys */
export type MessagingJourneyRow = {
  id: string;
  objectiveId: string | null;
  audienceId: string | null;
  journeyName: string;
  journeyType: MessagingJourneyType;
  status: MessagingJourneyStatus;
  startDate: string | null;
  endDate: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type MessagingJourneyType =
  | "turnout"
  | "volunteer"
  | "donor"
  | "event"
  | "persuasion"
  | "other";

export type MessagingJourneyStatus = "draft" | "active" | "paused" | "complete";

/** @see public.messaging_journey_steps */
export type MessagingJourneyStepRow = {
  id: number;
  journeyId: string;
  stepOrder: number;
  stepType: MessagingStepType;
  channel: MessagingOrchestrationChannel | null;
  templateKey: string | null;
  delayAfterPreviousValue: number | null;
  delayAfterPreviousUnit: MessagingDelayUnit | null;
  conditionLogic: JsonObject | null;
  audienceFilterOverride: JsonObject | null;
  requiresApproval: boolean;
};

export type MessagingStepType = "send" | "wait" | "condition" | "branch";

export type MessagingOrchestrationChannel =
  | "email"
  | "sms"
  | "p2p_sms"
  | "social"
  | "phone_followup";

export type MessagingDelayUnit = "minute" | "hour" | "day";

/** @see public.messaging_audiences */
export type MessagingAudienceRow = {
  id: string;
  name: string;
  queryDefinition: JsonObject;
  isDynamic: boolean;
  estimatedSize: number | null;
  lastEvaluatedAt: string | null;
  createdAt: string;
};

/** @see public.messaging_journey_enrollments */
export type MessagingJourneyEnrollmentRow = {
  id: number;
  personId: string;
  journeyId: string;
  currentStepOrder: number;
  status: MessagingEnrollmentStatus;
  lastStepAt: string | null;
  nextStepAt: string;
  metadata: JsonObject;
};

export type MessagingEnrollmentStatus =
  | "active"
  | "completed"
  | "exited"
  | "suppressed"
  | "waiting_branch";

export type OrchestratorTickResult = {
  processed: number;
  advanced: number;
  blocked: number;
  skipped: number;
  errors: string[];
  /** Else-path resolutions when a branch window expired without a matching engagement event. */
  branchElseResolved: number;
};

export type MessagingJourneyMetricsDailyRow = {
  journeyId: string;
  metricDate: string;
  enrollmentsNew: number;
  active: number;
  completed: number;
  exited: number;
  suppressed: number;
  sends: number;
};
