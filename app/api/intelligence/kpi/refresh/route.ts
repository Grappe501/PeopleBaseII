import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { getKpiRefreshSecret } from "@/lib/env";
import { secureStringEqual } from "@/lib/server/secure-compare";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Rebuild KPI materialized views. Protect with KPI_REFRESH_SECRET.
 * Schedule via cron or Supabase pg_cron calling SQL directly in production.
 */
export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const expected = getKpiRefreshSecret();
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!expected || !token || !secureStringEqual(token, expected)) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }
    await sql.unsafe("select public.refresh_kpi_intel()");
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
