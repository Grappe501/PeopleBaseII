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
