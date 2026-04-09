import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingAudienceRow } from "@/lib/types/contracts/messaging-orchestration";
import { createMessagingAudience, listMessagingAudiences } from "@/lib/queries/messaging-orchestration";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: MessagingAudienceRow[] }>>> {
  try {
    const rows = await listMessagingAudiences();
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const body = (await req.json()) as { name?: string; queryDefinition?: unknown; isDynamic?: boolean };
    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: "name is required." }, { status: 400 });
    }
    const id = await createMessagingAudience({
      name: body.name.trim(),
      queryDefinition: body.queryDefinition ?? {},
      isDynamic: body.isDynamic ?? true,
    });
    if (!id) {
      return NextResponse.json({ success: false, error: "Failed to create audience." }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
