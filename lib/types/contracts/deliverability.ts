export type DeliverabilityChannel = "email" | "sms" | "global";

export type DeliverabilityThresholdRow = {
  id: string;
  channel: DeliverabilityChannel;
  thresholdKey: string;
  warningValue: number | null;
  criticalValue: number | null;
  active: boolean;
  updatedAt: string;
};
