"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type CountyLookupRow = {
  countyId: number;
  countyName: string;
  countyKey: string | null;
};

type PeopleSearchRow = {
  personId: string;
  displayName: string;
  countyName: string | null;
  emailPrimary: string | null;
  phonePrimary: string | null;
};

type WorkflowTaskRow = {
  id: number;
  title: string;
  status: string;
  department: string;
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const qd = useDebounced(q.trim(), 150);

  const [counties, setCounties] = useState<CountyLookupRow[]>([]);
  const [tasks, setTasks] = useState<WorkflowTaskRow[]>([]);
  const [people, setPeople] = useState<PeopleSearchRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    // Prefetch stable lookups for fast local filtering.
    fetchJson<{ success: true; data: { rows: CountyLookupRow[] } }>(
      "/api/cm-hub/lookups/counties",
    )
      .then((r) => setCounties(r.data.rows))
      .catch(() => setCounties([]));

    // Workflows list endpoint doesn't have query param; we fetch a capped list and filter client-side.
    fetchJson<{ success: true; data: { rows: any[] } }>("/api/cm-hub/workflows/tasks?limit=200&q=")
      .then((r) =>
        setTasks(
          (r.data.rows ?? []).map((t: any) => ({
            id: Number(t.id),
            title: String(t.title ?? ""),
            status: String(t.status ?? ""),
            department: String(t.department ?? ""),
          })),
        ),
      )
      .catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!qd) {
      setPeople([]);
      setError(null);
      return;
    }
    setError(null);
    fetchJson<{ success: true; data: { people: PeopleSearchRow[] } }>(
      `/api/people/search?q=${encodeURIComponent(qd)}&limit=8`,
    )
      .then((r) => setPeople(r.data.people ?? []))
      .catch((e) => {
        setPeople([]);
        setError(e?.message ?? "Search failed");
      });
  }, [qd, open]);

  const countyHits = useMemo(() => {
    if (!qd) return counties.slice(0, 6);
    const x = qd.toLowerCase();
    return counties
      .filter((c) => c.countyName.toLowerCase().includes(x) || (c.countyKey ?? "").includes(x))
      .slice(0, 6);
  }, [counties, qd]);

  const taskHits = useMemo(() => {
    if (!qd) return tasks.slice(0, 5);
    const x = qd.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(x)).slice(0, 5);
  }, [tasks, qd]);

  return (
    <div ref={rootRef} className="relative w-full max-w-[520px]">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Search
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Counties, people, tasks…"
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setQ("");
            setPeople([]);
          }}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
        >
          Clear
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="grid gap-0 divide-y divide-white/10">
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Counties
              </p>
              <div className="mt-2 grid gap-1">
                {countyHits.map((c) => (
                  <Link
                    key={c.countyId}
                    href={c.countyKey ? `/counties/${c.countyKey}` : "/counties"}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                  >
                    <span className="font-semibold text-white">{c.countyName}</span>
                    {c.countyKey ? (
                      <span className="ml-2 text-xs text-slate-400">{c.countyKey}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>

            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                People
              </p>
              {error ? (
                <p className="mt-2 text-sm text-rose-200">{error}</p>
              ) : (
                <div className="mt-2 grid gap-1">
                  {people.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                      {qd ? "No matches yet." : "Type to search people."}
                    </p>
                  ) : (
                    people.map((p) => (
                      <Link
                        key={p.personId}
                        href={`/people/${p.personId}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{p.displayName}</p>
                          <span className="text-xs text-slate-400">{p.countyName ?? "—"}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {[p.emailPrimary, p.phonePrimary].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Workflow tasks
              </p>
              <div className="mt-2 grid gap-1">
                {taskHits.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                    {qd ? "No matching tasks." : "Type to filter tasks."}
                  </p>
                ) : (
                  taskHits.map((t) => (
                    <Link
                      key={t.id}
                      href="/cm-hub/workflows"
                      onClick={() => setOpen(false)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                    >
                      <p className="font-semibold text-white">{t.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {t.department} · {t.status} · #{t.id}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
            <span>Tip: search is fastest by email/phone.</span>
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-slate-300 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

