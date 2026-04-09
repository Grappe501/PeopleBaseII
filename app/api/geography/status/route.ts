import { NextResponse } from "next/server";
import { getGeographyStatus } from "@/lib/queries/geography";

export async function GET() {
  try {
    const data = await getGeographyStatus();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
