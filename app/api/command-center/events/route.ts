import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function forbiddenInProd() {
  return process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  if (forbiddenInProd()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "draft").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 200);

  const rows = await sql<
    Array<{
      id: string | number;
      title: string;
      description: string | null;
      starts_at: string;
      ends_at: string | null;
      location_name: string | null;
      location_address: string | null;
      scope_level: string;
      county_id: string | number | null;
      geo_city_id: string | number | null;
      precinct_label: string | null;
      event_status: string;
      submitted_at: string | null;
      approved_at: string | null;
      rejected_at: string | null;
      rejection_reason: string | null;
    }>
  >`
    select
      id,
      title,
      description,
      starts_at::text as starts_at,
      ends_at::text as ends_at,
      location_name,
      location_address,
      scope_level,
      county_id,
      geo_city_id,
      precinct_label,
      event_status,
      submitted_at::text as submitted_at,
      approved_at::text as approved_at,
      rejected_at::text as rejected_at,
      rejection_reason
    from public.events
    where event_status = ${status}
    order by starts_at asc
    limit ${limit}
  `;

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: Request) {
  if (forbiddenInProd()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        startsAt?: string;
        endsAt?: string | null;
        scopeLevel?: "statewide" | "county" | "place" | "precinct" | "custom";
        countyId?: number | null;
        geoCityId?: number | null;
        precinctLabel?: string | null;
        locationName?: string | null;
        locationAddress?: string | null;
        isPublished?: boolean;
      }
    | null;

  const title = body?.title?.trim() ?? "";
  const startsAt = body?.startsAt?.trim() ?? "";
  const scopeLevel = body?.scopeLevel ?? "statewide";

  if (!title || !startsAt) {
    return NextResponse.json(
      { success: false, error: "title and startsAt are required" },
      { status: 400 },
    );
  }

  const [row] = await sql<
    Array<{
      id: string | number;
    }>
  >`
    insert into public.events (
      title,
      description,
      starts_at,
      ends_at,
      location_name,
      location_address,
      scope_level,
      county_id,
      geo_city_id,
      precinct_label,
      is_published,
      event_status
    ) values (
      ${title},
      ${body?.description ?? null},
      ${startsAt}::timestamptz,
      ${body?.endsAt ?? null}::timestamptz,
      ${body?.locationName ?? null},
      ${body?.locationAddress ?? null},
      ${scopeLevel},
      ${body?.countyId ?? null},
      ${body?.geoCityId ?? null},
      ${body?.precinctLabel ?? null},
      ${body?.isPublished ?? true},
      'draft'
    )
    returning id
  `;

  return NextResponse.json({ success: true, id: Number(row?.id ?? 0) });
}

