import { NextResponse } from "next/server";
import { getDashboardStatus } from "@/lib/queries/dashboard";

export async function GET() {
  try {
    const data = await getDashboardStatus();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
