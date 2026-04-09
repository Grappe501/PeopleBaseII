"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FieldMobileTurfListPayload } from "@/lib/types/contracts/field-mobile";

type Tab = "assigned" | "available" | "completed";

function TurfCard({ t }: { t: FieldMobileTurfListPayload["available"][number] }) {
  return (
    <Link
      href={`/field/mobile/turf/${t.id}`}
      className="block rounded-3xl border border-white/10 bg-slate-900/50 p-5 hover:bg-slate-900/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{t.turfName}</p>
          <p className="mt-1 text-xs text-slate-400">
            {t.countyName ?? "—"} • {t.precinctLabel ?? "—"} •{" "}
            {t.doorCount != null ? `${t.doorCount} doors` : "doors —"}
          </p>
        </div>
        {t.priorityScore != null ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
            Priority {t.priorityScore.toFixed(1)}
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            —
          </span>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white">
          Start
        </span>
        <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white">
          Map
        </span>
      </div>
    </Link>
  );
}

export function TurfListClient() {
  const [tab, setTab] = useState<Tab>("available");
  const [payload, setPayload] = useState<FieldMobileTurfListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch("/api/field/mobile/turf?limit=50", { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: FieldMobileTurfListPayload; error?: string };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setPayload(json.data);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!payload) return [];
    if (tab === "assigned") return payload.assigned;
    if (tab === "completed") return payload.completed;
    return payload.available;
  }, [payload, tab]);

  return (
    <div className="space-y-3 px-4 py-5">
      <div className="flex gap-2">
        {(
          [
            ["assigned", "Assigned"],
            ["available", "Available"],
            ["completed", "Completed"],
          ] as const
        ).map(([k, label]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={[
                "flex-1 rounded-2xl border px-3 py-3 text-xs font-semibold",
                active
                  ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {!payload ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-300">
          Loading turfs…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-300">
          No turfs in this tab yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <TurfCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

