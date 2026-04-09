import type { CountySummaryRow, DashboardOverview, DashboardStatus } from "@/lib/types/dashboard";
import type { GeographyStatus } from "@/lib/types/geography";
import type { CensusCountyAcsRow, CensusStatus } from "@/lib/types/census";
import type { BlsLausCountyRow, BlsStatus } from "@/lib/types/bls";
import type { ElectionStatus, ElectionRow } from "@/lib/types/elections";
import type {
  CountyAnalyticsOverview,
  CountyPowerProfileRow,
  CountyRegistrationGapRow,
} from "@/lib/types/analytics";
import type { Cd2IntelSummary } from "@/lib/types/intelligence";
import type {
  Cd2SegmentHotspotRow,
  Cd2SegmentSummaryRow,
} from "@/lib/types/voter-scorecard";

export type DashboardPagePayload = {
  overview: DashboardOverview;
  status: DashboardStatus;
  countySummary: CountySummaryRow[];

  geoStatus: GeographyStatus;
  censusStatus: CensusStatus;
  censusSample: Array<CensusCountyAcsRow & { countyName: string; countyKey: string }>;

  blsStatus: BlsStatus;
  blsSample: Array<BlsLausCountyRow & { countyName: string; countyKey: string }>;

  electionStatus: ElectionStatus;
  recentElections: ElectionRow[];

  analyticsOverview: CountyAnalyticsOverview;
  powerProfiles: CountyPowerProfileRow[];
  registrationGaps: CountyRegistrationGapRow[];

  intelligence: {
    cd2Summary: Cd2IntelSummary | null;
    error: string | null;
  };

  segments: {
    summary: Cd2SegmentSummaryRow[] | null;
    hotspots: Cd2SegmentHotspotRow[] | null;
    error: string | null;
  };
};

