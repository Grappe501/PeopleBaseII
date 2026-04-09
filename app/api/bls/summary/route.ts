import { NextResponse } from "next/server";
import { getBlsSummary, getLatestBlsCountySummary } from "@/lib/queries/bls";

export async function GET() {
  try {
    const [status, sampleCounties] = await Promise.all([
      getBlsSummary(),
      getLatestBlsCountySummary(15),
    ]);
    return NextResponse.json({
      success: true,
      data: { status, sampleCounties },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
