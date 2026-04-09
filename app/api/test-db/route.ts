import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Deprecated endpoint. Use /api/dashboard/status or the dedicated analytics/intelligence routes.",
    },
    { status: 410 },
  );
}

