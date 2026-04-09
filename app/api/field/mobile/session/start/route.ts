import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

type StartSessionResponse = {
  sessionId: number;
  volunteerId: number;
  turfId: number;
};

async function ensureDemoVolunteer(): Promise<number> {
  const existing = await sql<Array<{ id: string | number }>>`
    select id from public.volunteers order by id asc limit 1
  `;
  if (existing[0]?.id != null) return Number(existing[0].id);

  const created = await sql<Array<{ id: string | number }>>`
    insert into public.volunteers (first_name, last_name, volunteer_status, onboarding_status)
    values ('Field', 'Canvasser', 'active', 'activated')
    returning id
  `;
  return Number(created[0]!.id);
}

async function ensureDemoTurf(): Promise<number> {
  const existing = await sql<Array<{ id: string | number }>>`
    select id from public.turfs order by id asc limit 1
  `;
  if (existing[0]?.id != null) return Number(existing[0].id);

  const created = await sql<Array<{ id: string | number }>>`
    insert into public.turfs (turf_name, precinct_label, door_count, priority_score, is_active)
    values ('Demo turf', 'Zone A', 48, 75.0, true)
    returning id
  `;
  return Number(created[0]!.id);
}

async function ensureDemoContacts(turfId: number): Promise<void> {
  const existing = await sql<Array<{ n: string | number }>>`
    select count(*)::bigint as n from public.canvass_contacts where turf_id = ${turfId}
  `;
  if (Number(existing[0]?.n ?? 0) > 0) return;

  await sql`
    insert into public.canvass_contacts (turf_id, address1, city, state, zip)
    values
      (${turfId}, '123 Main St', 'Little Rock', 'AR', '72201'),
      (${turfId}, '456 Oak Ave', 'Little Rock', 'AR', '72201'),
      (${turfId}, '789 Pine Dr', 'Little Rock', 'AR', '72201')
  `;
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<StartSessionResponse>>> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      turfId?: number;
      volunteerId?: number;
    };

    const volunteerId = Number.isFinite(Number(body.volunteerId))
      ? Number(body.volunteerId)
      : await ensureDemoVolunteer();
    const turfId = Number.isFinite(Number(body.turfId))
      ? Number(body.turfId)
      : await ensureDemoTurf();

    await ensureDemoContacts(turfId);

    const rows = await sql<Array<{ id: string | number }>>`
      insert into public.canvass_sessions (volunteer_id, turf_id, session_status)
      values (${volunteerId}, ${turfId}, 'active')
      returning id
    `;

    return NextResponse.json({
      success: true,
      data: { sessionId: Number(rows[0]!.id), volunteerId, turfId },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

