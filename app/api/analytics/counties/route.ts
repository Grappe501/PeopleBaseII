import { NextResponse } from "next/server";
import { getCountyPowerProfiles } from "@/lib/queries/analytics";

export async function GET() {
  try {
    const data = await getCountyPowerProfiles();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
