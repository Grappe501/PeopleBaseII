import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type {
  WorkflowCreateTaskInput,
  WorkflowDepartment,
  WorkflowListPayload,
  WorkflowTaskStatus,
} from "@/lib/types/contracts/cm-hub-workflows";
import { createWorkflowTask, listWorkflowTasks } from "@/lib/queries/cm-hub-workflows";

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

function asStatus(v: string | null): WorkflowTaskStatus | undefined {
  switch (v) {
    case "backlog":
    case "ready":
    case "in_progress":
    case "blocked":
    case "complete":
      return v;
    default:
      return undefined;
  }
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<WorkflowListPayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const department = asDept(searchParams.get("department"));
    const status = asStatus(searchParams.get("status"));
    const owner = searchParams.get("owner") ?? undefined;
    const countyIdRaw = searchParams.get("countyId");
    const countyId = countyIdRaw ? Number(countyIdRaw) : undefined;
    const limitRaw = Number(searchParams.get("limit"));
    const offsetRaw = Number(searchParams.get("offset"));
    const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
    const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

    const data = await listWorkflowTasks({ q, department, status, owner, countyId, limit, offset });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ taskId: number }>>> {
  try {
    const body = (await request.json()) as WorkflowCreateTaskInput;
    const created = await createWorkflowTask(body);
    return NextResponse.json({ success: true, data: { taskId: created.id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

