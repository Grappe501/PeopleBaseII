export type OutreachChannel = "email" | "sms" | "phone" | "mail";

export type ConsentStatus = "granted" | "denied" | "unknown";

export type SuppressionReason =
  | "opt_out"
  | "bounces"
  | "complaint"
  | "do_not_call"
  | "do_not_text"
  | "do_not_email"
  | "legal_hold"
  | "internal";

export type PersonChannelCompliance = {
  personId: string;
  channel: OutreachChannel;
  consentStatus: ConsentStatus;
  suppressionReason: string | null;
  isSuppressed: boolean;
};

