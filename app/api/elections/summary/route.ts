import { NextResponse } from "next/server";
import { getElectionSummary, listElections } from "@/lib/queries/elections";

export async function GET() {
  try {
    const [summary, recentElections] = await Promise.all([
      getElectionSummary(),
      listElections(12),
    ]);
    return NextResponse.json({
      success: true,
      data: { summary, recentElections },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
