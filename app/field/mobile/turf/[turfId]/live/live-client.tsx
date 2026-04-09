"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StartSessionData = { sessionId: number; volunteerId: number; turfId: number };

type NextContactData = {
  sessionId: number;
  contact: {
    contactId: number;
    fullName: string | null;
    address1: string;
    address2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    preferredLanguage: string | null;
  } | null;
  progress: { completed: number; total: number };
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!res.ok || !json.success || json.data == null) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data;
}

export function LiveClient({ turfId }: { turfId: number }) {
  const [session, setSession] = useState<StartSessionData | null>(null);
  const [next, setNext] = useState<NextContactData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const progressPct = useMemo(() => {
    const total = next?.progress.total ?? 0;
    if (!total) return 0;
    return Math.round(((next?.progress.completed ?? 0) / total) * 100);
  }, [next]);

  const loadNext = useCallback(
    async (s: StartSessionData) => {
      const data = await getJson<NextContactData>(
        `/api/field/mobile/turf/${turfId}/next?sessionId=${s.sessionId}`,
      );
      setNext(data);
    },
    [turfId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const s = await postJson<StartSessionData>("/api/field/mobile/session/start", { turfId });
        if (cancelled) return;
        setSession(s);
        await loadNext(s);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNext, turfId]);

  async function submitOutcome(responseType: string) {
    if (!session || !next?.contact) return;
    setBusy(true);
    try {
      setError(null);
      await postJson<{ ok: true }>(
        `/api/field/mobile/contact/${next.contact.contactId}/respond`,
        {
          sessionId: session.sessionId,
          volunteerId: session.volunteerId,
          responseType,
        },
      );
      await loadNext(session);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="px-4 py-5">
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      </div>
    );
  }

  if (!session || !next) {
    return (
      <div className="px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-300">
          Starting session…
        </div>
      </div>
    );
  }

  if (!next.contact) {
    return (
      <div className="px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Turf complete
          </p>
          <p className="mt-2 text-sm text-slate-300">
            All contacts in this turf have outcomes for this session.
          </p>
          <Link
            href="/field/mobile/turf"
            className="mt-4 inline-block rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Back to turf list
          </Link>
        </div>
      </div>
    );
  }

  const c = next.contact;

  return (
    <div className="space-y-4 px-4 py-5">
      <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Completed {next.progress.completed} / {next.progress.total}
          </p>
          <p className="text-xs text-slate-400">{progressPct}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-emerald-400/70" style={{ width: `${progressPct}%` }} />
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
          Current address
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{c.address1}</p>
        {c.address2 ? <p className="mt-1 text-sm text-slate-300">{c.address2}</p> : null}
        <p className="mt-1 text-sm text-slate-400">
          {[c.city, c.state, c.zip].filter(Boolean).join(", ")}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          {c.fullName ? `Name: ${c.fullName}` : "Name: unknown"} •{" "}
          {c.preferredLanguage ? `Lang: ${c.preferredLanguage}` : "Lang: unknown"}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <button
            disabled={busy}
            onClick={() => submitOutcome("not_home")}
            className="rounded-2xl border border-white/10 bg-slate-800/50 px-3 py-4 text-xs font-semibold text-white disabled:opacity-60"
          >
            Not Home
          </button>
          <Link
            href={`/field/mobile/contact/${c.contactId}/result?sessionId=${session.sessionId}&volunteerId=${session.volunteerId}&turfId=${turfId}`}
            className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-4 text-center text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
          >
            Contact Made
          </Link>
          <button
            disabled={busy}
            onClick={() => submitOutcome("bad_address")}
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-4 text-xs font-semibold text-white disabled:opacity-60"
          >
            Bad Address
          </button>
          <button
            disabled={busy}
            onClick={() => submitOutcome("refused")}
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-4 text-xs font-semibold text-white disabled:opacity-60"
          >
            Refused
          </button>
          <button
            disabled={busy}
            onClick={() => submitOutcome("skip")}
            className="rounded-2xl border border-white/10 bg-slate-800/50 px-3 py-4 text-xs font-semibold text-white disabled:opacity-60"
          >
            Skip
          </button>
          <button
            disabled
            className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-4 text-xs font-semibold text-white opacity-60"
          >
            Follow-up
          </button>
        </div>
      </section>
    </div>
  );
}

