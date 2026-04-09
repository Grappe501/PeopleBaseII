import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function forbiddenInProd() {
  return process.env.NODE_ENV === "production";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (forbiddenInProd()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: "invalid eventId" }, { status: 400 });
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(
      `
        update public.events
        set event_status = 'in_review',
            submitted_at = now(),
            updated_at = now()
        where id = $1
          and event_status = 'draft'
      `,
      [id],
    );
    await tx.unsafe(
      `
        insert into public.event_approvals (event_id, action, actor)
        values ($1, 'submit', $2)
      `,
      [id, "local_admin"],
    );
  });

  return NextResponse.json({ success: true });
}

