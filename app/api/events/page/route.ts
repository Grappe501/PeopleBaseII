import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { EventsDashboardPagePayload } from "@/lib/types/contracts/events-pages";
import { listUpcomingEvents } from "@/lib/queries/events";
import type { CalendarLevel } from "@/lib/types/events";

export const dynamic = "force-dynamic";

function asLevel(value: string | null): CalendarLevel {
  if (value === "county" || value === "place" || value === "precinct") return value;
  return "statewide";
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<EventsDashboardPagePayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const level = asLevel(searchParams.get("level"));
    const limitParam = searchParams.get("limit");
    const limitRaw = Number(limitParam);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    const countyIdRaw = searchParams.get("countyId");
    const geoCityIdRaw = searchParams.get("geoCityId");
    const precinctLabel = searchParams.get("precinctLabel") ?? undefined;

    const countyId = countyIdRaw != null && countyIdRaw !== "" ? Number(countyIdRaw) : undefined;
    const geoCityId = geoCityIdRaw != null && geoCityIdRaw !== "" ? Number(geoCityIdRaw) : undefined;

    const upcoming = await listUpcomingEvents({
      level,
      limit,
      countyId,
      geoCityId,
      precinctLabel,
    });

    return NextResponse.json({
      success: true,
      data: {
        filters: { level, limit, countyId, geoCityId, precinctLabel },
        upcoming,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

