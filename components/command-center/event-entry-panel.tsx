"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name?: string | null;
  location_address?: string | null;
  scope_level: string;
  event_status: string;
  rejection_reason: string | null;
};

type Props = {
  defaultScopeLevel?: "statewide" | "county" | "place" | "precinct" | "custom";
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

export function EventEntryPanel({ defaultScopeLevel = "statewide" }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [scopeLevel, setScopeLevel] = useState(defaultScopeLevel);
  const [isPublished, setIsPublished] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");

  const [counties, setCounties] = useState<Array<{ id: number; name: string; key: string }>>([]);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [places, setPlaces] = useState<Array<{ id: number; name: string; key: string }>>([]);
  const [geoCityId, setGeoCityId] = useState<number | null>(null);
  const [precincts, setPrecincts] = useState<Array<{ label: string }>>([]);
  const [precinctLabel, setPrecinctLabel] = useState<string>("");

  const [drafts, setDrafts] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canCreate = useMemo(() => title.trim().length > 0 && startsAt.trim().length > 0, [title, startsAt]);

  const loadDrafts = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/command-center/events?status=draft&limit=50", {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.success) {
      setErr(json?.error ?? `Failed to load drafts (HTTP ${res.status})`);
      return;
    }
    setDrafts(
      (json.data ?? []).map((r: any) => ({
        id: Number(r.id),
        title: String(r.title ?? ""),
        description: r.description ?? null,
        starts_at: String(r.starts_at ?? ""),
        ends_at: r.ends_at ?? null,
        scope_level: String(r.scope_level ?? ""),
        event_status: String(r.event_status ?? ""),
        rejection_reason: r.rejection_reason ?? null,
      })),
    );
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/command-center/geo?type=counties", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as any;
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setCounties(
          json.data.map((c: any) => ({
            id: Number(c.id),
            name: String(c.name ?? ""),
            key: String(c.key ?? ""),
          })),
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (scopeLevel !== "county" && scopeLevel !== "place" && scopeLevel !== "precinct") return;
    if (!countyId) return;
    if (scopeLevel === "place") {
      (async () => {
        const res = await fetch(`/api/command-center/geo?type=places&countyId=${countyId}&limit=200`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as any;
        if (res.ok && json?.success && Array.isArray(json.data)) {
          setPlaces(
            json.data.map((p: any) => ({
              id: Number(p.id),
              name: String(p.name ?? ""),
              key: String(p.key ?? ""),
            })),
          );
        }
      })();
    }
    if (scopeLevel === "precinct") {
      (async () => {
        const res = await fetch(`/api/command-center/geo?type=precincts&countyId=${countyId}&limit=500`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as any;
        if (res.ok && json?.success && Array.isArray(json.data)) {
          setPrecincts(
            json.data.map((p: any) => ({ label: String(p.label ?? "") })).filter((p: any) => p.label),
          );
        }
      })();
    }
  }, [countyId, scopeLevel]);

  async function createDraft() {
    setOkMsg(null);
    setErr(null);
    if (!canCreate) return;
    setLoading(true);
    try {
      const res = await fetch("/api/command-center/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          startsAt,
          endsAt: endsAt.trim() ? endsAt : null,
          scopeLevel,
          countyId: scopeLevel === "county" || scopeLevel === "place" || scopeLevel === "precinct" ? countyId : null,
          geoCityId: scopeLevel === "place" ? geoCityId : null,
          precinctLabel: scopeLevel === "precinct" ? precinctLabel.trim() || null : null,
          locationName: locationName.trim() ? locationName.trim() : null,
          locationAddress: locationAddress.trim() ? locationAddress.trim() : null,
          isPublished,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.success) {
        setErr(json?.error ?? `Create failed (HTTP ${res.status})`);
        return;
      }
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setLocationName("");
      setLocationAddress("");
      setGeoCityId(null);
      setPrecinctLabel("");
      setOkMsg(`Draft created (#${json.id}).`);
      await loadDrafts();
    } finally {
      setLoading(false);
    }
  }

  async function submitDraft(id: number) {
    setOkMsg(null);
    setErr(null);
    const res = await fetch(`/api/command-center/events/${id}/submit`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.success) {
      setErr(json?.error ?? `Submit failed (HTTP ${res.status})`);
      return;
    }
    setOkMsg(`Submitted for review (#${id}).`);
    await loadDrafts();
  }

  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Event entry</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Create a draft event</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Drafts do not appear on any calendars until approved.
          </p>
        </div>
        <button
          onClick={() => void loadDrafts()}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Refresh drafts
        </button>
      </div>

      {err ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {err}
        </div>
      ) : null}
      {okMsg ? (
        <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-200">
          {okMsg}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="Event title…"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 min-h-[84px] w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="Optional details…"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Starts at
          </label>
          <input
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="2026-04-10T18:00:00-05:00"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Ends at
          </label>
          <input
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Scope
          </label>
          <select
            value={scopeLevel}
            onChange={(e) => setScopeLevel(e.target.value as any)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
          >
            <option value="statewide">statewide</option>
            <option value="county">county</option>
            <option value="place">place</option>
            <option value="precinct">precinct</option>
            <option value="custom">custom</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Published flag
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="isPublished"
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="isPublished" className="text-sm text-slate-300">
              Allow showing after approval
            </label>
          </div>
        </div>
      </div>

      {(scopeLevel === "county" || scopeLevel === "place" || scopeLevel === "precinct") ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              County
            </label>
            <select
              value={countyId ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCountyId(Number.isFinite(v) && v > 0 ? v : null);
                setGeoCityId(null);
                setPrecinctLabel("");
              }}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            >
              <option value="">Select county…</option>
              {counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {scopeLevel === "place" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Place
              </label>
              <select
                value={geoCityId ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setGeoCityId(Number.isFinite(v) && v > 0 ? v : null);
                }}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
              >
                <option value="">Select place…</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scopeLevel === "precinct" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Precinct
              </label>
              <select
                value={precinctLabel}
                onChange={(e) => setPrecinctLabel(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
              >
                <option value="">Select precinct…</option>
                {precincts.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Location name
          </label>
          <input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="Community center, courthouse, park…"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Location address
          </label>
          <input
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="Street, city, state ZIP…"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={!canCreate || loading}
          onClick={() => void createDraft()}
          className="rounded-2xl border border-white/10 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          Create draft
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <div className="bg-slate-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Drafts ({drafts.length})
        </div>
        {drafts.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-400">No drafts.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {drafts.map((d) => (
              <li key={d.id} className="bg-slate-900/40 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{d.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      #{d.id} · {fmtWhen(d.starts_at)} · scope {d.scope_level}
                    </p>
                    {d.description ? (
                      <p className="mt-2 text-sm text-slate-300">{d.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10"
                      href={`/api/command-center/events/${d.id}/ics`}
                    >
                      Download ICS
                    </a>
                    <button
                      onClick={() => void submitDraft(d.id)}
                      className="rounded-2xl border border-white/10 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/20"
                    >
                      Submit for review
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

