import { NextResponse } from "next/server";
import { getCensusStatus } from "@/lib/queries/census";

export async function GET() {
  try {
    const data = await getCensusStatus();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
