function readEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return undefined;
  return v.trim();
}

function missingEnvMessage(name: string): string {
  return `Missing required environment variable: ${name}. Set it in your shell or in a .env file (e.g. .env.local) loaded for this process.`;
}

/** Throws with a clear message if the variable is unset or blank. */
export function requireEnv(name: string): string {
  const v = readEnv(name);
  if (!v) throw new Error(missingEnvMessage(name));
  return v;
}

export function getDatabaseUrl(): string | undefined {
  return readEnv("DATABASE_URL");
}

export function requireDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}

export function getCensusApiKey(): string | undefined {
  return readEnv("CENSUS_API_KEY");
}

export function requireCensusApiKey(): string {
  return requireEnv("CENSUS_API_KEY");
}

export function getBlsApiKey(): string | undefined {
  return readEnv("BLS_API_KEY");
}

export function requireBlsApiKey(): string {
  return requireEnv("BLS_API_KEY");
}

export function getOpenAiApiKey(): string | undefined {
  return readEnv("OPENAI_API_KEY");
}

export function requireOpenAiApiKey(): string {
  return requireEnv("OPENAI_API_KEY");
}

/** SendGrid — server only; never use NEXT_PUBLIC_. */
export function getSendGridApiKey(): string | undefined {
  return readEnv("SENDGRID_API_KEY");
}

/** Verified sender email in SendGrid (single sender v1). */
export function getSendGridFromEmail(): string | undefined {
  return readEnv("SENDGRID_FROM_EMAIL");
}

export function getTwilioAccountSid(): string | undefined {
  return readEnv("TWILIO_ACCOUNT_SID");
}

export function getTwilioAuthToken(): string | undefined {
  return readEnv("TWILIO_AUTH_TOKEN");
}

/** E.164, e.g. +15551234567 */
export function getTwilioFromNumber(): string | undefined {
  return readEnv("TWILIO_FROM_NUMBER");
}

/** If "true", skip provider HTTP calls; still writes compliance log as sent (for local testing). */
export function isCommsDryRun(): boolean {
  return readEnv("COMMS_PROVIDER_DRY_RUN") === "true";
}

/** Optional: POST /api/intelligence/kpi/refresh Authorization: Bearer … */
export function getKpiRefreshSecret(): string | undefined {
  return readEnv("KPI_REFRESH_SECRET");
}

/** Optional: POST /api/messaging/orchestrator/tick Authorization: Bearer … */
export function getMessagingOrchestratorSecret(): string | undefined {
  return readEnv("MESSAGING_ORCHESTRATOR_SECRET");
}
