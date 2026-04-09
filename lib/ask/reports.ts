import {
  getCampaignKpiAskPayload,
  getMessagingJourneysAskSummary,
  getPersonAskSnapshotForAsk,
  getWorkflowTasksSummaryForAsk,
} from "@/lib/queries/ask-summaries";
import { isUuid } from "@/lib/ask/context-pack";
import { getCd2CountyIntel, getCd2IntelSummary, getCd2PrecinctIntel } from "@/lib/queries/intelligence";
import { getCd2DemTargetPrecincts } from "@/lib/queries/targeting";
import { getCd2SegmentSummary } from "@/lib/queries/voter-scorecard";
import type { AskReportId } from "@/lib/types/intelligence";

export type AskReportResult = {
  id: AskReportId;
  title: string;
  /** JSON-serializable payload for the model / client */
  payload: unknown;
};

const MAX_ROWS = 250;

export async function runAskReport(
  id: AskReportId,
  options?: {
    limit?: number;
    precinctSort?: "blank_density" | "headroom";
    /** Required for `person_ask_snapshot`. */
    personId?: string | null;
  },
): Promise<AskReportResult | null> {
  const limit = Math.min(options?.limit ?? 120, MAX_ROWS);

  switch (id) {
    case "cd2_intel_summary": {
      const payload = await getCd2IntelSummary();
      return {
        id,
        title: "CD2 intelligence summary (county model residuals + top precincts by blank density)",
        payload,
      };
    }
    case "cd2_county_intel": {
      const rows = await getCd2CountyIntel();
      return {
        id,
        title: "CD2 counties: ACS+BLS model expected Dem % vs observed 2024",
        payload: { rows },
      };
    }
    case "cd2_precinct_intel": {
      const rows = await getCd2PrecinctIntel({
        limit,
        sort: options?.precinctSort ?? "blank_density",
      });
      return {
        id,
        title: "CD2 precincts: blank density + headroom vs demographic model",
        payload: { rows },
      };
    }
    case "cd2_target_precincts": {
      const rows = await getCd2DemTargetPrecincts({
        limit,
        maxQuintile: 2,
      });
      return {
        id,
        title: "CD2 targeting precincts (quintiles 1–2)",
        payload: { rows },
      };
    }
    case "cd2_segment_summary": {
      const rows = await getCd2SegmentSummary();
      return {
        id,
        title: "CD2 voter segment counts (initiative-weighted scorecard)",
        payload: { rows },
      };
    }
    case "campaign_kpi_snapshot": {
      const topCounties = Math.min(75, Math.max(5, limit));
      const payload = await getCampaignKpiAskPayload(topCounties);
      return {
        id,
        title: "Campaign KPI snapshot (volunteers, people, comms 7d, field, workflows, top counties)",
        payload,
      };
    }
    case "workflow_tasks_summary": {
      const sample = Math.min(120, Math.max(10, limit));
      const payload = await getWorkflowTasksSummaryForAsk(sample);
      return {
        id,
        title: "Workflow tasks: counts by status/department + sample of open tasks",
        payload,
      };
    }
    case "messaging_journeys_summary": {
      const journeyLim = Math.min(50, Math.max(5, limit));
      const payload = await getMessagingJourneysAskSummary(journeyLim);
      return {
        id,
        title: "Messaging journeys: status + enrollment rollups per journey",
        payload,
      };
    }
    case "person_ask_snapshot": {
      const pid = options?.personId?.trim() ?? "";
      if (!pid || !isUuid(pid)) return null;
      const payload = await getPersonAskSnapshotForAsk(pid);
      if (!payload) return null;
      return {
        id,
        title:
          "Person snapshot: profile, channel compliance, tags, recent activity, journey enrollments, linked workflow tasks",
        payload,
      };
    }
    default:
      return null;
  }
}

export const ASK_REPORT_CATALOG: { id: AskReportId; description: string }[] = [
  {
    id: "cd2_intel_summary",
    description:
      "Overview: all CD2 counties model vs vote + top precincts by simulated blank density.",
  },
  {
    id: "cd2_county_intel",
    description:
      "County table: model expected Dem %, observed 2024, residual, poverty, unemployment.",
  },
  {
    id: "cd2_precinct_intel",
    description:
      "Precinct table: blank_density_score, headroom to model, archetype, registration-weighted lift.",
  },
  {
    id: "cd2_target_precincts",
    description: "Existing CD2 targeting scores (dem growth + initiative) quintiles 1–2.",
  },
  {
    id: "cd2_segment_summary",
    description:
      "Counts per segment_bucket (heavy_dem_supporter, persuadable, volunteer_potential, etc.).",
  },
  {
    id: "campaign_kpi_snapshot",
    description:
      "Campaign-wide KPIs (volunteers, people, outbound comms 7d, events, field contacts, workflow tasks) plus top counties by intelligence score.",
  },
  {
    id: "workflow_tasks_summary",
    description:
      "Workflow task counts by status and department, non-complete total, and a sample list of tasks (blocked/deps visible).",
  },
  {
    id: "messaging_journeys_summary",
    description:
      "Messaging orchestration journeys with enrollment counts (active, waiting_branch, completed, exited/suppressed).",
  },
  {
    id: "person_ask_snapshot",
    description:
      "Person 360: canonical profile flags, per-channel compliance, assigned tags, recent person_activity, messaging journey enrollments for this person, workflow_tasks linked by person_id. Only available when the client sends a valid person UUID in context.",
  },
];
