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
  options?: { limit?: number; precinctSort?: "blank_density" | "headroom" },
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
];
