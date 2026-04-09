import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { getVolunteersDashboardPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

export type CmHubOverviewPayload = {
  snapshot: {
    activeVolunteers: number | null;
    countiesActive: number | null;
    eventsThisWeek: number | null;
    messagesSent: number | null;
    fundsRaised: number | null;
    fieldContactsMade: number | null;
  };
};

export async function GET(): Promise<NextResponse<ApiResponse<CmHubOverviewPayload>>> {
  try {
    const volunteers = await getVolunteersDashboardPayload();
    const payload: CmHubOverviewPayload = {
      snapshot: {
        activeVolunteers: volunteers.metrics.activeVolunteers,
        countiesActive: null,
        eventsThisWeek: null,
        messagesSent: null,
        fundsRaised: null,
        fieldContactsMade: null,
      },
    };
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

