import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/queries/people";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { PeopleSearchRow } from "@/lib/types/people";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const countyIdRaw = url.searchParams.get("countyId");
    const countyId = countyIdRaw ? Number(countyIdRaw) : undefined;
    const volunteerOnly = (url.searchParams.get("volunteerOnly") ?? "false") === "true";
    const donorOnly = (url.searchParams.get("donorOnly") ?? "false") === "true";

    const data = await searchPeople({ q, limit, countyId, volunteerOnly, donorOnly });

    const body: ApiResponse<{ people: PeopleSearchRow[] }> = {
      success: true,
      data: { people: data },
    };
    return NextResponse.json(body);
  } catch (err: any) {
    const body: ApiResponse<never> = {
      success: false,
      error: err?.message ?? "Unknown error",
    };
    return NextResponse.json(body, { status: 500 });
  }
}

