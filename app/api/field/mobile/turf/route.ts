import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { FieldMobileTurfListPayload } from "@/lib/types/contracts/field-mobile";
import { getFieldMobileTurfListPayload } from "@/lib/queries/field";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<FieldMobileTurfListPayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit"));
    const countyIdRaw = searchParams.get("countyId");
    const volunteerIdRaw = searchParams.get("volunteerId");
    const activeOnlyRaw = searchParams.get("activeOnly");

    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
    const countyId =
      countyIdRaw != null && countyIdRaw !== "" ? Number(countyIdRaw) : undefined;
    const assignedToVolunteerId =
      volunteerIdRaw != null && volunteerIdRaw !== "" ? Number(volunteerIdRaw) : undefined;
    const activeOnly = activeOnlyRaw === "false" ? false : true;

    const data = await getFieldMobileTurfListPayload({
      limit,
      countyId,
      activeOnly,
      assignedToVolunteerId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

