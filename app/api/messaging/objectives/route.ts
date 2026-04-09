import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingObjectiveRow } from "@/lib/types/contracts/messaging-orchestration";
import { createMessagingObjective, listMessagingObjectives } from "@/lib/queries/messaging-orchestration";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: MessagingObjectiveRow[] }>>> {
  try {
    const rows = await listMessagingObjectives();
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const body = (await req.json()) as { objectiveKey?: string; name?: string; description?: string | null };
    if (!body.objectiveKey?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: "objectiveKey and name are required." },
        { status: 400 },
      );
    }
    const id = await createMessagingObjective({
      objectiveKey: body.objectiveKey.trim(),
      name: body.name.trim(),
      description: body.description ?? null,
    });
    if (!id) {
      return NextResponse.json({ success: false, error: "Failed to upsert objective." }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
