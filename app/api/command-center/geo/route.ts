import { NextResponse } from "next/server";
import sql from "@/lib/db";
import type { ApiResponse } from "@/lib/types/contracts/api";

export const dynamic = "force-dynamic";

function forbiddenInProd() {
  return process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  if (forbiddenInProd()) {
    const body: ApiResponse<never> = { success: false, error: "Not found" };
    return NextResponse.json(body, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "").trim();

  if (type === "counties") {
    const rows = await sql<
      Array<{ id: string | number; county_name: string; county_key: string }>
    >`
      select id, county_name, county_key
      from public.geo_counties
      where state_fips = '05'
      order by county_name
    `;
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: Number(r.id),
        name: r.county_name,
        key: r.county_key,
      })),
    });
  }

  if (type === "places") {
    const countyId = Number(searchParams.get("countyId") ?? "");
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "30"), 1), 200);
    if (!Number.isFinite(countyId) || countyId <= 0) {
      return NextResponse.json(
        { success: false, error: "countyId required" },
        { status: 400 },
      );
    }

    const rows = await sql<
      Array<{ geo_city_id: string | number; city_name: string; city_key: string; place_fips: string | null }>
    >`
      select
        v.geo_city_id,
        v.city_name,
        v.city_key,
        gc.place_fips
      from public.geo_city_primary_county_v v
      left join public.geo_cities gc
        on gc.id = v.geo_city_id
      where v.county_id = ${countyId}
        and (${q} = '' or v.city_name ilike ${"%" + q + "%"})
      order by v.city_name
      limit ${limit}
    `;
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: Number(r.geo_city_id),
        name: r.city_name,
        key: r.city_key,
        placeFips: r.place_fips,
      })),
    });
  }

  if (type === "precincts") {
    const countyId = Number(searchParams.get("countyId") ?? "");
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 500);
    if (!Number.isFinite(countyId) || countyId <= 0) {
      return NextResponse.json(
        { success: false, error: "countyId required" },
        { status: 400 },
      );
    }

    const rows = await sql<Array<{ precinct_label: string }>>`
      select distinct precinct_label
      from public.statewide_precinct_priority_v
      where county_id = ${countyId}
        and precinct_label is not null
        and trim(precinct_label) <> ''
        and (${q} = '' or precinct_label ilike ${"%" + q + "%"})
      order by precinct_label
      limit ${limit}
    `;
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ label: r.precinct_label })),
    });
  }

  return NextResponse.json({ success: false, error: "unknown type" }, { status: 400 });
}

