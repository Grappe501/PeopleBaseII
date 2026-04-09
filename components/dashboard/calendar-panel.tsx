import type { CalendarEventRow } from "@/lib/types/events";
import { SectionCard } from "./section-card";

type Props = {
  title?: string;
  description?: string;
  events: CalendarEventRow[];
};

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function googleCalendarLink(e: CalendarEventRow): string {
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replaceAll("-", "")
      .replaceAll(":", "")
      .replaceAll(".000", "");
  const dates = `${fmt(start)}/${fmt(end)}`;
  const details = [e.description ?? ""].filter(Boolean).join("\n");
  const location = [e.locationName, e.locationAddress].filter(Boolean).join(" — ");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", e.title);
  url.searchParams.set("dates", dates);
  if (details) url.searchParams.set("details", details);
  if (location) url.searchParams.set("location", location);
  return url.toString();
}

export function CalendarPanel({ title, description, events }: Props) {
  return (
    <SectionCard
      title={title ?? "Upcoming events"}
      description={
        description ??
        "Events roll up upstream (place → county → statewide). This panel shows the next scheduled items."
      }
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
        <div className="max-h-[min(520px,70vh)] overflow-auto">
          {events.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              No upcoming events yet.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {events.map((e) => (
                <li key={`${e.calendarLevel}-${e.eventId}`} className="bg-slate-900/40 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{e.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {fmtWhen(e.startsAt)}
                        {e.locationName ? ` · ${e.locationName}` : ""}
                        {e.locationAddress ? ` · ${e.locationAddress}` : ""}
                      </p>
                      {e.description ? (
                        <p className="mt-2 text-sm text-slate-300">{e.description}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <a
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-slate-200 hover:bg-white/10"
                          href={googleCalendarLink(e)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Add to Google Calendar
                        </a>
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {e.calendarLevel}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

