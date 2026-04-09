import { NextResponse } from "next/server";
import { getBlsStatus } from "@/lib/queries/bls";

export async function GET() {
  try {
    const data = await getBlsStatus();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
