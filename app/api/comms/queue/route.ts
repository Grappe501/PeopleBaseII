import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CommsQueueListPayload } from "@/lib/types/contracts/comms";
import {
  createCommsQueueDraft,
  getTemplateByKey,
  listCommsQueue,
  mergeTemplateForPerson,
} from "@/lib/queries/comms";

export const dynamic = "force-dynamic";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request): Promise<NextResponse<ApiResponse<CommsQueueListPayload>>> {
  try {
    const u = new URL(req.url);
    const limit = Number(u.searchParams.get("limit") ?? "50");
    const rows = await listCommsQueue(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: number }>>> {
  try {
    const body = (await req.json()) as {
      personId: string;
      channel: "email" | "sms";
      templateKey?: string | null;
      subject?: string | null;
      body?: string | null;
      createdBy?: string | null;
    };
    if (!body.personId || !isUuid(body.personId)) {
      return NextResponse.json({ success: false, error: "personId (UUID) is required." }, { status: 400 });
    }
    const ch = body.channel === "sms" ? "sms" : "email";

    let subject = body.subject ?? null;
    let text = body.body ?? "";

    if (body.templateKey?.trim()) {
      const t = await getTemplateByKey(body.templateKey.trim());
      if (!t) {
        return NextResponse.json({ success: false, error: "Unknown templateKey." }, { status: 400 });
      }
      if (t.channel !== ch) {
        return NextResponse.json(
          { success: false, error: "Template channel does not match request channel." },
          { status: 400 },
        );
      }
      const merged = await mergeTemplateForPerson(t.body, t.subject, body.personId);
      text = merged.body;
      subject = merged.subject;
    }

    if (!text.trim()) {
      return NextResponse.json({ success: false, error: "body is required (or use templateKey)." }, { status: 400 });
    }

    const id = await createCommsQueueDraft({
      personId: body.personId,
      channel: ch,
      templateKey: body.templateKey?.trim() ?? null,
      subject,
      body: text,
      createdBy: body.createdBy ?? null,
    });
    if (!id) {
      return NextResponse.json({ success: false, error: "Failed to create queue row." }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
