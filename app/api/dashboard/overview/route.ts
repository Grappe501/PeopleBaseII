import { NextResponse } from "next/server";
import { getDashboardOverview } from "@/lib/queries/dashboard";

export async function GET() {
  try {
    const data = await getDashboardOverview();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
