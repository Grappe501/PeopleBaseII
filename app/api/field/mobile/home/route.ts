import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { FieldMobileHomePayload } from "@/lib/types/contracts/field-mobile";
import { getFieldMobileHomePayload } from "@/lib/queries/field";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<FieldMobileHomePayload>>> {
  try {
    const data = await getFieldMobileHomePayload();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

