import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type TaskDependencyRow = {
  dependsOnTaskId: number;
  title: string;
  status: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<NextResponse<ApiResponse<{ rows: TaskDependencyRow[] }>>> {
  try {
    const { taskId } = await params;
    const id = Number(taskId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "Invalid taskId" }, { status: 400 });
    }

    const rows = await sql<
      Array<{ depends_on_task_id: string | number; title: string; status: string }>
    >`
      select d.depends_on_task_id, t.title, t.status
      from public.workflow_task_dependencies d
      join public.workflow_tasks t on t.id = d.depends_on_task_id
      where d.task_id = ${id}
      order by t.updated_at desc, t.id desc
      limit 250
    `;

    return NextResponse.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          dependsOnTaskId: Number(r.depends_on_task_id),
          title: r.title,
          status: r.status,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

