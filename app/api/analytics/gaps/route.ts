import { NextResponse } from "next/server";
import { getCountyRegistrationGaps } from "@/lib/queries/analytics";

/** Weakest registration penetration first (null rates last). */
export async function GET() {
  try {
    const data = await getCountyRegistrationGaps("penetrationAsc");
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
