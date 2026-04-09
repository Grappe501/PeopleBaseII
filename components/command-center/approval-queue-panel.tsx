"use client";

import { useCallback, useEffect, useState } from "react";

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

export function ApprovalQueuePanel() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [tab, setTab] = useState<"in_review" | "approved" | "rejected">("in_review");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [rejectReasonById, setRejectReasonById] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(`/api/command-center/events?status=${tab}&limit=150`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.success) {
      setErr(json?.error ?? `Failed to load queue (HTTP ${res.status})`);
      return;
    }
    setRows(
      (json.data ?? []).map((r: any) => ({
        id: Number(r.id),
        title: String(r.title ?? ""),
        description: r.description ?? null,
        starts_at: String(r.starts_at ?? ""),
        ends_at: r.ends_at ?? null,
        location_name: r.location_name ?? null,
        location_address: r.location_address ?? null,
        scope_level: String(r.scope_level ?? ""),
        event_status: String(r.event_status ?? ""),
        rejection_reason: r.rejection_reason ?? null,
      })),
    );
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: number, decision: "approve" | "reject") {
    setOkMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const reason = (rejectReasonById[id] ?? "").trim();
      const res = await fetch(`/api/command-center/events/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          decision === "approve" ? { decision } : { decision, reason },
        ),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.success) {
        setErr(json?.error ?? `Decision failed (HTTP ${res.status})`);
        return;
      }
      setOkMsg(`${decision === "approve" ? "Approved" : "Rejected"} event #${id}.`);
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Approval queue
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Events workflow</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Review queue + history. Only approved events appear on rollup calendars.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Refresh queue
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["in_review", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            {t.replaceAll("_", " ")}
          </button>
        ))}
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

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="bg-slate-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          {tab.replaceAll("_", " ")} ({rows.length})
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-400">No events waiting for approval.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((e) => (
              <li key={e.id} className="bg-slate-900/40 px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-white">{e.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      #{e.id} · {fmtWhen(e.starts_at)} · scope {e.scope_level}
                    </p>
                    {(e.location_name || e.location_address) ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {[e.location_name, e.location_address].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {e.description ? (
                      <p className="mt-2 text-sm text-slate-300">{e.description}</p>
                    ) : null}
                    {tab === "rejected" && e.rejection_reason ? (
                      <p className="mt-2 text-sm text-rose-200/90">
                        Rejection reason: {e.rejection_reason}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      {tab === "in_review" ? (
                        <input
                          value={rejectReasonById[e.id] ?? ""}
                          onChange={(ev) =>
                            setRejectReasonById((s) => ({
                              ...s,
                              [e.id]: ev.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-rose-400/40"
                          placeholder="Rejection reason (required to reject)…"
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10"
                          href={`/api/command-center/events/${e.id}/ics`}
                        >
                          ICS
                        </a>
                        {tab === "in_review" ? (
                          <>
                            <button
                              disabled={loading}
                              onClick={() => void decide(e.id, "approve")}
                              className="rounded-2xl border border-white/10 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => void decide(e.id, "reject")}
                              className="rounded-2xl border border-white/10 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
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

