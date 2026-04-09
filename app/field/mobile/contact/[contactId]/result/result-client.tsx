"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Sentiment =
  | "very_positive"
  | "positive"
  | "mixed"
  | "negative"
  | "declined"
  | "unknown";

const SENTIMENTS: Array<{ label: string; value: Sentiment }> = [
  { label: "Very Positive", value: "very_positive" },
  { label: "Positive", value: "positive" },
  { label: "Mixed", value: "mixed" },
  { label: "Negative", value: "negative" },
  { label: "Declined to Say", value: "declined" },
  { label: "Unknown", value: "unknown" },
];

const ISSUE_TAGS = [
  "Voting / democracy",
  "Cost of living",
  "Education",
  "Healthcare",
  "Jobs",
  "Trust / corruption",
  "Other",
] as const;

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
}

export function ResultClient({ contactId }: { contactId: number }) {
  const sp = useSearchParams();
  const router = useRouter();

  const sessionId = Number(sp.get("sessionId"));
  const volunteerId = Number(sp.get("volunteerId"));
  const turfId = Number(sp.get("turfId"));

  const canSubmit = useMemo(
    () => Number.isFinite(sessionId) && sessionId > 0 && Number.isFinite(volunteerId) && volunteerId > 0,
    [sessionId, volunteerId],
  );

  const [sentiment, setSentiment] = useState<Sentiment>("unknown");
  const [issues, setIssues] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSaveNext() {
    if (!canSubmit) {
      setError("Missing session context. Return to live canvassing and try again.");
      return;
    }
    setBusy(true);
    try {
      setError(null);
      await postJson(`/api/field/mobile/contact/${contactId}/respond`, {
        sessionId,
        volunteerId,
        responseType: "contact_made",
        sentiment,
        issues,
        note: note.trim() ? note.trim() : null,
      });
      if (Number.isFinite(turfId) && turfId > 0) {
        router.push(`/field/mobile/turf/${turfId}/live`);
      } else {
        router.push("/field/mobile/turf");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-5">
      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Outcome</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {SENTIMENTS.map((c) => {
            const active = sentiment === c.value;
            return (
              <button
                key={c.value}
                disabled={busy}
                onClick={() => setSentiment(c.value)}
                className={[
                  "rounded-2xl border px-3 py-4 text-sm font-semibold",
                  active
                    ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                  busy ? "opacity-60" : "",
                ].join(" ")}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Issues heard</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ISSUE_TAGS.map((t) => {
            const active = issues.includes(t);
            return (
              <button
                key={t}
                disabled={busy}
                onClick={() =>
                  setIssues((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
                }
                className={[
                  "rounded-full border px-3 py-2 text-xs font-semibold",
                  active
                    ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                    : "border-white/10 bg-slate-950/30 text-slate-200 hover:bg-slate-900/60",
                  busy ? "opacity-60" : "",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Notes</p>
        <textarea
          className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short note…"
        />
        <button
          disabled={busy}
          onClick={onSaveNext}
          className="mt-4 w-full rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
        >
          Save & Next
        </button>
      </section>
    </div>
  );
}

