import sql from "@/lib/db";
import type {
  Cd2SegmentHotspotRow,
  Cd2SegmentSummaryRow,
  Cd2VoterScorecardRow,
} from "@/lib/types/voter-scorecard";

export async function getCd2SegmentSummary(): Promise<Cd2SegmentSummaryRow[]> {
  const rows = await sql<{ segment_bucket: string; c: string | number }[]>`
    select segment_bucket, count(*)::bigint as c
    from public.cd2_voter_scorecard_v
    group by segment_bucket
    order by c desc
  `;
  return rows.map((r) => ({
    segmentBucket: r.segment_bucket,
    voterCount: Number(r.c),
  }));
}

/** Precincts with the most voters in a given segment (default: persuadable). */
export async function getCd2SegmentHotspots(options: {
  segment?: string;
  limit?: number;
}): Promise<Cd2SegmentHotspotRow[]> {
  const segment = options.segment ?? "persuadable";
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 500);

  const rows = await sql<
    {
      county_id: string | number;
      county_name: string | null;
      precinct_label: string | null;
      segment_bucket: string | null;
      voter_count: string | number | null;
      segment_share_per_1k_registrants: string | number | null;
    }[]
  >`
    select
      county_id,
      county_name,
      precinct_label,
      segment_bucket,
      voter_count,
      segment_share_per_1k_registrants
    from public.cd2_segment_hotspots_v
    where segment_bucket = ${segment}
    order by voter_count desc nulls last
    limit ${limit}
  `;

  return rows.map((r) => ({
    countyId: r.county_id,
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    segmentBucket: r.segment_bucket,
    voterCount: r.voter_count != null ? Number(r.voter_count) : 0,
    segmentSharePer1kRegistrants:
      r.segment_share_per_1k_registrants != null
        ? Number(r.segment_share_per_1k_registrants)
        : null,
  }));
}

export async function getCd2VoterScorecardRows(options: {
  limit?: number;
  offset?: number;
  segment?: string;
}): Promise<Cd2VoterScorecardRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 300, 1), 5000);
  const offset = Math.max(options.offset ?? 0, 0);

  if (options.segment) {
    const rows = await sql<
      {
        voter_id: string | null;
        key_registrant: string | null;
        county_id: string | number;
        county_name: string | null;
        precinct_label: string | null;
        dem_lean_score: string | number | null;
        campaign_engagement_score: string | number | null;
        funder_potential_proxy_score: string | number | null;
        segment_bucket: string | null;
        initiative_breadth: string | number | null;
      }[]
    >`
      select
        voter_id,
        key_registrant,
        county_id,
        county_name,
        precinct_label,
        dem_lean_score,
        campaign_engagement_score,
        funder_potential_proxy_score,
        segment_bucket,
        initiative_breadth
      from public.cd2_voter_scorecard_v
      where segment_bucket = ${options.segment}
      order by campaign_engagement_score desc nulls last
      limit ${limit}
      offset ${offset}
    `;
    return mapScorecard(rows);
  }

  const rows = await sql<
    {
      voter_id: string | null;
      key_registrant: string | null;
      county_id: string | number;
      county_name: string | null;
      precinct_label: string | null;
      dem_lean_score: string | number | null;
      campaign_engagement_score: string | number | null;
      funder_potential_proxy_score: string | number | null;
      segment_bucket: string | null;
      initiative_breadth: string | number | null;
    }[]
  >`
    select
      voter_id,
      key_registrant,
      county_id,
      county_name,
      precinct_label,
      dem_lean_score,
      campaign_engagement_score,
      funder_potential_proxy_score,
      segment_bucket,
      initiative_breadth
    from public.cd2_voter_scorecard_v
    order by campaign_engagement_score desc nulls last
    limit ${limit}
    offset ${offset}
  `;

  return mapScorecard(rows);
}

function mapScorecard(
  rows: {
    voter_id: string | null;
    key_registrant: string | null;
    county_id: string | number;
    county_name: string | null;
    precinct_label: string | null;
    dem_lean_score: string | number | null;
    campaign_engagement_score: string | number | null;
    funder_potential_proxy_score: string | number | null;
    segment_bucket: string | null;
    initiative_breadth: string | number | null;
  }[],
): Cd2VoterScorecardRow[] {
  return rows.map((r) => ({
    voterId: r.voter_id,
    keyRegistrant: r.key_registrant,
    countyId: r.county_id,
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    demLeanScore: r.dem_lean_score != null ? Number(r.dem_lean_score) : null,
    campaignEngagementScore:
      r.campaign_engagement_score != null
        ? Number(r.campaign_engagement_score)
        : null,
    funderPotentialProxyScore:
      r.funder_potential_proxy_score != null
        ? Number(r.funder_potential_proxy_score)
        : null,
    segmentBucket: r.segment_bucket,
    initiativeBreadth:
      r.initiative_breadth != null ? Number(r.initiative_breadth) : null,
  }));
}
