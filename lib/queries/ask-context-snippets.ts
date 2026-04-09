import sql from "@/lib/db";

export type PersonAskSnippet = {
  displayName: string | null;
  countyKey: string | null;
  countyName: string | null;
};

export async function getPersonAskSnippet(personId: string): Promise<PersonAskSnippet | null> {
  const rows = await sql<
    Array<{
      display_name: string | null;
      first_name: string | null;
      county_key: string | null;
      county_name: string | null;
    }>
  >`
    select
      p.display_name,
      p.first_name,
      gc.county_key,
      gc.county_name
    from public.people p
    left join public.geo_counties gc on gc.id = p.primary_county_id
    where p.id = ${personId}::uuid
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  const displayName =
    (r.display_name ?? "").trim() ||
    (r.first_name ?? "").trim() ||
    null;
  return {
    displayName,
    countyKey: r.county_key,
    countyName: r.county_name,
  };
}

export type CountyAskSnippet = {
  countyId: number;
  countyName: string;
  countyKey: string;
};

export async function getCountyAskSnippet(countyKey: string): Promise<CountyAskSnippet | null> {
  const rows = await sql<
    Array<{
      id: string | number;
      county_name: string;
      county_key: string;
    }>
  >`
    select id, county_name, county_key
    from public.geo_counties
    where lower(county_key) = lower(${countyKey})
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    countyId: Number(r.id),
    countyName: r.county_name,
    countyKey: r.county_key,
  };
}
