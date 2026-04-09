import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CountiesListPagePayload } from "@/lib/types/contracts/counties-pages";
import { listStatewideCounties } from "@/lib/queries/county-pages";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<CountiesListPagePayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limitParam = searchParams.get("limit");
    const limitRaw = Number(limitParam);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 75;

    const rows = await listStatewideCounties({ q, limit });
    return NextResponse.json({
      success: true,
      data: {
        filters: { q, limit },
        rows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

