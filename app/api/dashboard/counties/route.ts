import { NextResponse } from "next/server";
import { getCountySummary } from "@/lib/queries/dashboard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get("limit")?.trim() ?? "";
    let limit = 25;
    if (rawLimit !== "") {
      const n = Number(rawLimit);
      if (Number.isFinite(n)) limit = n;
    }

    const data = await getCountySummary(limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
