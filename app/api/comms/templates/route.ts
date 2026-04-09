import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CommsTemplatesListPayload } from "@/lib/types/contracts/comms";
import { listCommsTemplates } from "@/lib/queries/comms";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<CommsTemplatesListPayload>>> {
  try {
    const rows = await listCommsTemplates(true);
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: number }>>> {
  try {
    const body = (await req.json()) as {
      templateKey: string;
      name: string;
      channel: "email" | "sms";
      subject?: string | null;
      body: string;
    };
    if (!body.templateKey?.trim() || !body.name?.trim() || !body.body?.trim()) {
      return NextResponse.json({ success: false, error: "templateKey, name, and body are required." }, { status: 400 });
    }
    const ch = body.channel === "sms" ? "sms" : "email";
    const rows = await sql<Array<{ id: string | number }>>`
      insert into public.comms_templates (template_key, name, channel, subject, body, is_active)
      values (${body.templateKey.trim()}, ${body.name.trim()}, ${ch}, ${body.subject ?? null}, ${body.body}, true)
      on conflict (template_key) do update set
        name = excluded.name,
        channel = excluded.channel,
        subject = excluded.subject,
        body = excluded.body,
        is_active = true,
        updated_at = now()
      returning id
    `;
    return NextResponse.json({ success: true, data: { id: Number(rows[0]?.id ?? 0) } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
