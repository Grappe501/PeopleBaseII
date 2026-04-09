import sql from "@/lib/db";
import type {
  ElectionRow,
  ElectionStatus,
  ElectionSummary,
  PrecinctResultRow,
  PrecinctTurnoutRow,
} from "@/lib/types/elections";

export async function getElectionStatus(): Promise<ElectionStatus> {
  const empty: ElectionStatus = {
    tableReady: false,
    electionCount: 0,
    raceCount: 0,
    precinctResultCount: 0,
    precinctTurnoutCount: 0,
    latestElectionYear: null,
  };
  try {
    const [e, r, pr, pt, y] = await Promise.all([
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from elections
      `,
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from races
      `,
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from election_results
      `,
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from county_election_turnout
      `,
      sql<[{ y: number | null }]>`
        select max(election_year)::int as y from elections
      `,
    ]);
    return {
      tableReady: true,
      electionCount: Number(e[0]?.n ?? 0),
      raceCount: Number(r[0]?.n ?? 0),
      precinctResultCount: Number(pr[0]?.n ?? 0),
      precinctTurnoutCount: Number(pt[0]?.n ?? 0),
      latestElectionYear: y[0]?.y ?? null,
    };
  } catch {
    return empty;
  }
}

export async function getElectionSummary(): Promise<ElectionSummary> {
  const status = await getElectionStatus();
  return {
    electionCount: status.electionCount,
    raceCount: status.raceCount,
    resultRowCount: status.precinctResultCount,
    turnoutRowCount: status.precinctTurnoutCount,
    latestElectionYear: status.latestElectionYear,
  };
}

export async function listElections(limit = 20): Promise<ElectionRow[]> {
  const safe = Math.min(100, Math.max(1, limit));
  try {
    const rows = await sql<
      {
        id: string | number;
        election_key: string;
        election_date: string | null;
        election_year: number;
        election_type: string;
        description: string | null;
      }[]
    >`
      select id, election_key, election_date::text, election_year, election_type, description
      from elections
      order by election_year desc, election_date desc nulls last
      limit ${safe}
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      electionKey: row.election_key,
      electionDate: row.election_date,
      electionYear: row.election_year,
      electionType: row.election_type,
      description: row.description,
    }));
  } catch {
    return [];
  }
}

export async function getPrecinctResultsByRace(
  raceKey: string,
): Promise<PrecinctResultRow[]> {
  const key = raceKey.trim();
  if (!key) return [];
  try {
    const rows = await sql<
      {
        id: string | number;
        race_id: string | number;
        county_id: string | number;
        precinct_id: string | number | null;
        source_precinct_code: string | null;
        source_precinct_name: string | null;
        candidate_name: string;
        party: string | null;
        votes: string | number;
        total_votes_in_race: string | number | null;
        vote_share: string | number | null;
        source_file: string | null;
      }[]
    >`
      select pr.id, pr.race_id, pr.county_id, null::bigint as precinct_id,
             pr.source_precinct_code, pr.source_precinct_name,
             pr.candidate_name, pr.party, pr.votes,
             pr.total_votes_at_location as total_votes_in_race,
             pr.vote_share_pct as vote_share,
             pr.source_file_name as source_file
      from election_results pr
      join races r on r.id = pr.race_id
      where r.race_key = ${key}
        and pr.geography_type = 'precinct'
      order by pr.county_id, pr.source_precinct_name nulls last, pr.candidate_name
      limit 50000
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      raceId: Number(row.race_id),
      countyId: Number(row.county_id),
      precinctId: row.precinct_id !== null ? Number(row.precinct_id) : null,
      sourcePrecinctCode: row.source_precinct_code,
      sourcePrecinctName: row.source_precinct_name,
      candidateName: row.candidate_name,
      party: row.party,
      votes: Number(row.votes),
      totalVotesInRace:
        row.total_votes_in_race !== null ? Number(row.total_votes_in_race) : null,
      voteShare: row.vote_share !== null ? Number(row.vote_share) : null,
      sourceFile: row.source_file,
    }));
  } catch {
    return [];
  }
}

export async function getPrecinctTurnoutByElection(
  electionKey: string,
): Promise<PrecinctTurnoutRow[]> {
  const key = electionKey.trim();
  if (!key) return [];
  try {
    const rows = await sql<
      {
        id: string | number;
        election_id: string | number;
        county_id: string | number;
        precinct_id: string | number | null;
        source_precinct_code: string | null;
        source_precinct_name: string | null;
        registered_voters: string | number | null;
        ballots_cast: string | number | null;
        turnout_rate: string | number | null;
        source_file: string | null;
      }[]
    >`
      select pt.id, pt.election_id, pt.county_id, null::bigint as precinct_id,
             null::text as source_precinct_code, null::text as source_precinct_name,
             pt.registered_voters, pt.ballots_cast,
             case
               when pt.registered_voters is not null
                 and pt.registered_voters > 0
                 and pt.ballots_cast is not null
               then round(
                 (pt.ballots_cast::numeric / pt.registered_voters::numeric) * 100,
                 2
               )
             end as turnout_rate,
             pt.data_source as source_file
      from county_election_turnout pt
      join elections e on e.id = pt.election_id
      where e.election_key = ${key}
      order by pt.county_id
      limit 50000
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      electionId: Number(row.election_id),
      countyId: Number(row.county_id),
      precinctId: row.precinct_id !== null ? Number(row.precinct_id) : null,
      sourcePrecinctCode: row.source_precinct_code,
      sourcePrecinctName: row.source_precinct_name,
      registeredVoters:
        row.registered_voters !== null ? Number(row.registered_voters) : null,
      ballotsCast: row.ballots_cast !== null ? Number(row.ballots_cast) : null,
      turnoutRate: row.turnout_rate !== null ? Number(row.turnout_rate) : null,
      sourceFile: row.source_file,
    }));
  } catch {
    return [];
  }
}
