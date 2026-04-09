import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function forbiddenInProd() {
  return process.env.NODE_ENV === "production";
}

function escapeIcsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function toIcsUtc(dtIso: string) {
  const d = new Date(dtIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export async function GET(
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

  const rows = await sql<
    Array<{
      id: string | number;
      title: string;
      description: string | null;
      starts_at: string;
      ends_at: string | null;
      location_name: string | null;
      location_address: string | null;
      event_status: string;
      is_published: boolean;
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
      event_status,
      is_published
    from public.events
    where id = ${id}
    limit 1
  `;
  const e = rows[0];
  if (!e) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Allow downloading even if not approved (local admin workflows), but mark clearly.
  const summary = e.title;
  const description =
    (e.event_status !== "approved" ? `[${e.event_status}] ` : "") + (e.description ?? "");
  const loc = [e.location_name, e.location_address].filter(Boolean).join(" — ");

  const dtStart = toIcsUtc(e.starts_at);
  const dtEnd = e.ends_at ? toIcsUtc(e.ends_at) : null;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PeopleBaseII//CommandCenter//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:peoplebaseii-event-${e.id}@local`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    dtEnd ? `DTEND:${dtEnd}` : null,
    `SUMMARY:${escapeIcsText(summary)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    loc ? `LOCATION:${escapeIcsText(loc)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="event_${e.id}.ics"`,
    },
  });
}

