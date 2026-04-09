import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Deprecated endpoint. Use ingestion scripts or dedicated admin routes.",
    },
    { status: 410 },
  );
}

