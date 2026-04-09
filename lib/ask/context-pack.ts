import type { AskClientContextPack } from "@/lib/types/contracts/agent-context";
import { getCountyAskSnippet, getPersonAskSnippet } from "@/lib/queries/ask-context-snippets";

export type EnrichedAskContext = {
  /** Human-readable lines for the LLM (router + summarizer). */
  hints: string;
  /** Short line for UI / response metadata. */
  summaryLine: string;
};

/** Validates UUID v4-style ids for Ask context and person-scoped reports. */
export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Resolve DB-backed labels for routing and summarization focus.
 */
export async function enrichAskContext(pack: AskClientContextPack | undefined): Promise<EnrichedAskContext> {
  if (!pack || !pack.pathname) {
    return { hints: "", summaryLine: "" };
  }

  const lines: string[] = [];
  lines.push(`surface=${pack.surface}`);
  lines.push(`path=${pack.pathname}`);

  if (pack.personId?.trim() && isUuid(pack.personId)) {
    const p = await getPersonAskSnippet(pack.personId.trim());
    if (p) {
      lines.push(`person_id=${pack.personId}`);
      if (p.displayName) lines.push(`person_display_name=${p.displayName}`);
      if (p.countyKey) lines.push(`person_primary_county_key=${p.countyKey}`);
      if (p.countyName) lines.push(`person_primary_county_name=${p.countyName}`);
    } else {
      lines.push(`person_id=${pack.personId}`);
      lines.push("person_lookup=not_found");
    }
  }

  if (pack.countyKey?.trim()) {
    const c = await getCountyAskSnippet(pack.countyKey.trim());
    if (c) {
      lines.push(`county_id=${c.countyId}`);
      lines.push(`county_key=${c.countyKey}`);
      lines.push(`county_name=${c.countyName}`);
    } else {
      lines.push(`county_key=${pack.countyKey}`);
      lines.push("county_lookup=not_found");
    }
  }

  if (pack.cityKey?.trim()) {
    lines.push(`city_key=${pack.cityKey.trim()}`);
  }

  const hints = lines.join("\n");

  let summaryLine = "";
  if (pack.surface === "person" && pack.personId) {
    summaryLine = "Person 360";
  } else if (pack.surface === "county" && pack.countyKey) {
    summaryLine = `County: ${pack.countyKey}`;
  } else if (pack.surface === "workflows") {
    summaryLine = "Workflows";
  } else if (pack.surface === "cm_hub") {
    summaryLine = "CM Hub";
  } else if (pack.surface === "dashboard") {
    summaryLine = "Dashboard";
  }

  return { hints, summaryLine };
}

/** Router: bias instructions derived from surface (no PII). */
export function routerBiasFromSurface(surface: AskClientContextPack["surface"]): string {
  switch (surface) {
    case "workflows":
      return "The user is on the workflows/board area; prefer workflow_tasks_summary for task and bottleneck questions.";
    case "cm_hub":
      return "The user is in CM Hub; campaign_kpi_snapshot and messaging_journeys_summary are often relevant.";
    case "dashboard":
      return "The user is on the dashboard; campaign_kpi_snapshot and cd2_intel_summary may both apply.";
    case "county":
      return "The user is viewing a county context; cd2_county_intel or campaign_kpi_snapshot are relevant; when summarizing, emphasize the matching county row if present in the JSON.";
    case "person":
      return "The user is on a person profile; prefer person_ask_snapshot for identity, compliance, tags, activity, journeys, and linked workflow tasks when a person id is present; otherwise fall back to campaign_kpi_snapshot.";
    case "command_center":
      return "The user is in command center (events/calendar); workflow_tasks_summary and campaign_kpi_snapshot may help.";
    default:
      return "";
  }
}
