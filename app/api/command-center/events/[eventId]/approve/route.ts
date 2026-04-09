import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function forbiddenInProd() {
  return process.env.NODE_ENV === "production";
}

export async function POST(
  request: Request,
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

  const body = (await request.json().catch(() => null)) as
    | { decision?: "approve" | "reject"; reason?: string }
    | null;
  const decision = body?.decision ?? "approve";
  const reason = body?.reason?.trim() ?? null;

  if (decision === "reject" && (!reason || reason.length < 3)) {
    return NextResponse.json(
      { success: false, error: "rejection reason required" },
      { status: 400 },
    );
  }

  await sql.begin(async (tx) => {
    if (decision === "approve") {
      await tx.unsafe(
        `
          update public.events
          set event_status = 'approved',
              approved_at = now(),
              approved_by = $2,
              rejected_at = null,
              rejected_by = null,
              rejection_reason = null,
              updated_at = now()
          where id = $1
            and event_status = 'in_review'
        `,
        [id, "local_admin"],
      );
      await tx.unsafe(
        `
          insert into public.event_approvals (event_id, action, actor)
          values ($1, 'approve', $2)
        `,
        [id, "local_admin"],
      );
    } else {
      await tx.unsafe(
        `
          update public.events
          set event_status = 'rejected',
              rejected_at = now(),
              rejected_by = $2,
              rejection_reason = $3,
              updated_at = now()
          where id = $1
            and event_status = 'in_review'
        `,
        [id, "local_admin", reason],
      );
      await tx.unsafe(
        `
          insert into public.event_approvals (event_id, action, actor, reason)
          values ($1, 'reject', $2, $3)
        `,
        [id, "local_admin", reason],
      );
    }
  });

  return NextResponse.json({ success: true });
}

