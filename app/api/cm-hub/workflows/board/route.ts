import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { WorkflowBoardPayload, WorkflowDepartment } from "@/lib/types/contracts/cm-hub-workflows";
import { getWorkflowBoard } from "@/lib/queries/cm-hub-workflows";

export const dynamic = "force-dynamic";

function asDept(v: string | null): WorkflowDepartment | undefined {
  switch (v) {
    case "campaign":
    case "field":
    case "volunteers":
    case "events":
    case "comms":
    case "social":
    case "digital":
    case "fundraising":
    case "data":
      return v;
    default:
      return undefined;
  }
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<WorkflowBoardPayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const department = asDept(searchParams.get("department"));
    const owner = searchParams.get("owner") ?? undefined;
    const countyIdRaw = searchParams.get("countyId");
    const countyId = countyIdRaw ? Number(countyIdRaw) : undefined;
    const limitRaw = Number(searchParams.get("limit"));
    const offsetRaw = Number(searchParams.get("offset"));
    const limit = Number.isFinite(limitRaw) ? limitRaw : 500;
    const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

    const data = await getWorkflowBoard({ department, owner, countyId, limit, offset });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

