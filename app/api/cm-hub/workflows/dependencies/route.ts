import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { WorkflowDependencyInput } from "@/lib/types/contracts/cm-hub-workflows";
import { addWorkflowDependency, removeWorkflowDependency } from "@/lib/queries/cm-hub-workflows";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const body = (await request.json()) as WorkflowDependencyInput;
    await addWorkflowDependency(body);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const body = (await request.json()) as WorkflowDependencyInput;
    await removeWorkflowDependency(body);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

