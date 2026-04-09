import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { VolunteerDetailPagePayload } from "@/lib/types/contracts/volunteers-pages";
import { getVolunteerDetailPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ volunteerId: string }> },
): Promise<NextResponse<ApiResponse<VolunteerDetailPagePayload>>> {
  try {
    const { volunteerId } = await params;
    const id = Number(volunteerId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid volunteerId" },
        { status: 400 },
      );
    }

    const data = await getVolunteerDetailPayload(id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

