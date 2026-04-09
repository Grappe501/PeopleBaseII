import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CountyDetailPagePayload } from "@/lib/types/contracts/counties-pages";
import {
  getCountyDetailByKey,
  listCountyCitiesByKey,
  listCountyPrecinctsByKey,
} from "@/lib/queries/county-pages";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ countyKey: string }> },
): Promise<NextResponse<ApiResponse<CountyDetailPagePayload>>> {
  try {
    const { countyKey } = await params;
    const county = await getCountyDetailByKey(countyKey);
    if (!county) {
      return NextResponse.json(
        { success: false, error: "County not found" },
        { status: 404 },
      );
    }

    const [cities, precincts] = await Promise.all([
      listCountyCitiesByKey(countyKey, { limit: 75 }),
      listCountyPrecinctsByKey(countyKey, { limit: 150 }),
    ]);

    return NextResponse.json({ success: true, data: { county, cities, precincts } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

