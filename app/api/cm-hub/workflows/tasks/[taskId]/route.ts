import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { WorkflowTaskRow, WorkflowUpdateTaskInput } from "@/lib/types/contracts/cm-hub-workflows";
import { listWorkflowTasks, updateWorkflowTask } from "@/lib/queries/cm-hub-workflows";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<NextResponse<ApiResponse<{ task: WorkflowTaskRow | null }>>> {
  try {
    const { taskId } = await params;
    const id = Number(taskId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "Invalid taskId" }, { status: 400 });
    }
    const list = await listWorkflowTasks({ limit: 1, offset: 0 });
    const task = list.rows.find((t) => t.id === id) ?? null;
    return NextResponse.json({ success: true, data: { task } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const { taskId } = await params;
    const id = Number(taskId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "Invalid taskId" }, { status: 400 });
    }
    const body = (await request.json()) as Omit<WorkflowUpdateTaskInput, "id">;
    await updateWorkflowTask({ ...body, id });
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

