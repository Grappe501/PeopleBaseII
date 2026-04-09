import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { DeliverabilityThresholdRow } from "@/lib/types/contracts/deliverability";
import { listDeliverabilityThresholds } from "@/lib/queries/deliverability-thresholds";

export const dynamic = "force-dynamic";

/**
 * Read tunable deliverability thresholds (bounce/complaint/opt-out/sender health bands).
 * Safe for internal dashboards; does not expose secrets.
 */
export async function GET(): Promise<NextResponse<ApiResponse<{ rows: DeliverabilityThresholdRow[] }>>> {
  try {
    const rows = await listDeliverabilityThresholds(true);
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
