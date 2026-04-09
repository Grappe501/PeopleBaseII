import { NextResponse } from "next/server";
import { getCountyAnalyticsOverview } from "@/lib/queries/analytics";

export async function GET() {
  try {
    const data = await getCountyAnalyticsOverview();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
