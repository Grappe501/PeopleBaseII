import Link from "next/link";
import { listUpcomingEvents } from "@/lib/queries/events";
import { listStatewideCounties } from "@/lib/queries/county-pages";
import { getDashboardOverview } from "@/lib/queries/dashboard";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";

export const dynamic = "force-dynamic";

function fmtInt(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export default async function Home() {
  const [events, topCounties, overview] = await Promise.all([
    listUpcomingEvents({ level: "statewide", limit: 6 }),
    listStatewideCounties({ limit: 6 }),
    getDashboardOverview(),
  ]);

  return (
    <PageShell>
      <PageHero
        eyebrow="Kelly Grappe for Arkansas Secretary of State"
        title="Arkansas civic engagement command center"
        description="People over politics. Always. Built to serve all 75 counties with steady, transparent administration—turning data into action: county profiles, precinct opportunity, and a calendar that rolls up from the smallest place to the statewide plan."
        actions={
          <>
            <Link
              href="/counties"
              className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              County intelligence
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-sky-400/25 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
            >
              Data dashboard
            </Link>
            <Link
              href="/command-center/calendar"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Calendar command center (local)
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
            Data intake
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(overview.totalRawVrRows)}</p>
          <p className="mt-1 text-sm text-slate-400">
            Raw VR rows · {fmtInt(overview.countyCount)} counties seen
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
            Upcoming events
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(events.length)}</p>
          <p className="mt-1 text-sm text-slate-400">Approved events in statewide rollup</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
            Priority counties
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(topCounties.length)}</p>
          <p className="mt-1 text-sm text-slate-400">Quick links into the field map</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-black/25 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Start here
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              County → place → precinct drilldowns
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Consistent numbers from statewide targets down to counties, cities/towns, and top
              precincts—built for organizers.
            </p>
            <div className="mt-4">
              <Link className="text-sm font-semibold text-sky-200 hover:underline" href="/counties">
                Open counties →
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-black/25 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Calendar system
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              One statewide calendar that rolls up
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Enter events at the smallest level. Every approved event flows upstream into the
              county and statewide calendar automatically.
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-semibold text-emerald-200 hover:underline"
                href="/command-center/calendar"
              >
                Open calendar command center →
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-black/25 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Operating principle
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">People over politics</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This system prioritizes opportunity, turnout gaps, registration gaps, and civic
              re‑engagement—without person-level partisan labels.
            </p>
            <div className="mt-4">
              <Link className="text-sm font-semibold text-violet-200 hover:underline" href="/dashboard">
                Open data dashboard →
              </Link>
            </div>
          </div>
        </section>

      <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-black/25 backdrop-blur lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Top counties right now
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {topCounties.map((c) => (
                <Link
                  key={c.countyId}
                  href={c.countyKey ? `/counties/${c.countyKey}` : "/counties"}
                  className="group rounded-3xl border border-white/10 bg-slate-950/40 p-4 hover:bg-slate-950/55"
                >
                  <p className="font-semibold text-white group-hover:text-sky-100">
                    {c.countyName}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    VR {fmtInt(c.vrUniqueVoters)} · Target {fmtInt(c.countyTargetVotes)}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-black/25 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Statewide calendar
            </p>
            <div className="mt-4 space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-slate-400">No upcoming events yet.</p>
              ) : (
                events.map((e) => (
                  <div key={e.eventId} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="font-semibold text-white">{e.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{e.startsAt}</p>
                    <a
                      className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
                      href="https://calendar.google.com/calendar/render?action=TEMPLATE"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Google Calendar
                    </a>
                  </div>
                ))
              )}
              <Link className="text-sm font-semibold text-emerald-200 hover:underline" href="/counties">
                View counties →
              </Link>
            </div>
          </div>
        </section>
    </PageShell>
  );
}
