import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { getCampaignIntelRowPreferMv, getCountiesActiveCount } from "@/lib/queries/kpi-intelligence";

export const dynamic = "force-dynamic";

export type CmHubOverviewPayload = {
  snapshot: {
    activeVolunteers: number | null;
    countiesActive: number | null;
    eventsThisWeek: number | null;
    messagesSent: number | null;
    fundsRaised: number | null;
    fieldContactsMade: number | null;
    peopleTotal: number | null;
    peopleVolunteers: number | null;
    openWorkflowTasks: number | null;
    blockedWorkflowTasks: number | null;
    intelSource: "materialized" | "live_view";
  };
};

export async function GET(): Promise<NextResponse<ApiResponse<CmHubOverviewPayload>>> {
  try {
    const intel = await getCampaignIntelRowPreferMv();
    const countiesActive = await getCountiesActiveCount();

    const payload: CmHubOverviewPayload = {
      snapshot: {
        activeVolunteers: intel.activeVolunteers,
        countiesActive: Number.isFinite(countiesActive) ? countiesActive : null,
        eventsThisWeek: intel.eventsThisWeek,
        messagesSent: intel.commsOutbound7d,
        fundsRaised: null,
        fieldContactsMade: intel.fieldContacts7d,
        peopleTotal: intel.peopleTotal,
        peopleVolunteers: intel.peopleVolunteers,
        openWorkflowTasks: intel.openWorkflowTasks,
        blockedWorkflowTasks: intel.blockedWorkflowTasks,
        intelSource: intel.source,
      },
    };
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
