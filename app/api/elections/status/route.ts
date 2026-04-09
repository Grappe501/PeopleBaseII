import { NextResponse } from "next/server";
import { getElectionStatus } from "@/lib/queries/elections";

export async function GET() {
  try {
    const data = await getElectionStatus();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
