export type SystemStatusTone = "success" | "warning" | "danger" | "neutral";

export type SystemStatusCheck = {
  key: string;
  label: string;
  kind: "table" | "view" | "api" | "page";
  expectedName: string;
  ok: boolean;
  details?: string | null;
};

export type SystemStatusModule = {
  key: string;
  name: string;
  tone: SystemStatusTone;
  summary: string;
  checks: SystemStatusCheck[];
  metrics?: Record<string, number | string | null> | null;
};

export type SystemStatusPayload = {
  computedAt: string;
  overallTone: SystemStatusTone;
  modules: SystemStatusModule[];
};

