import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { VolunteersListPagePayload } from "@/lib/types/contracts/volunteers-pages";
import { listVolunteers } from "@/lib/queries/volunteers";
import type { VolunteerStatus } from "@/lib/types/volunteers";

export const dynamic = "force-dynamic";

function asStatus(value: string | null): VolunteerStatus | undefined {
  if (value === "new" || value === "active" || value === "inactive") return value;
  return undefined;
}

export async function GET(
  request: Request,
): Promise<NextResponse<ApiResponse<VolunteersListPagePayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limitRaw = Number(searchParams.get("limit"));
    const offsetRaw = Number(searchParams.get("offset"));
    const countyIdRaw = searchParams.get("countyId");
    const status = asStatus(searchParams.get("status"));

    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
    const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;
    const countyId =
      countyIdRaw != null && countyIdRaw !== "" ? Number(countyIdRaw) : undefined;

    const data = await listVolunteers({ q, limit, offset, countyId, status });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

