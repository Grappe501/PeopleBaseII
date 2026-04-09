import { NextResponse } from "next/server";
import { getCensusCountySnapshots } from "@/lib/queries/census";

export async function GET() {
  try {
    const counties = await getCensusCountySnapshots();
    return NextResponse.json({ success: true, data: { counties } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
