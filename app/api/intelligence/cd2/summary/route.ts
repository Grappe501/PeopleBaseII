import { NextResponse } from "next/server";
import { getCd2IntelSummary } from "@/lib/queries/intelligence";

export async function GET() {
  try {
    const data = await getCd2IntelSummary();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
