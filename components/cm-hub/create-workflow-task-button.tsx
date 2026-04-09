"use client";

import { useMemo, useState } from "react";

type Dept =
  | "campaign"
  | "field"
  | "volunteers"
  | "events"
  | "comms"
  | "social"
  | "digital"
  | "fundraising"
  | "data";

type Priority = "low" | "medium" | "high" | "critical";

type Status = "backlog" | "ready" | "in_progress" | "blocked" | "complete";

type Props = {
  label?: string;
  defaultTitle?: string;
  defaultDepartment?: Dept;
  defaultPriority?: Priority;
  defaultStatus?: Status;
  countyId?: number | null;
  volunteerId?: number | null;
  turfId?: number | null;
  eventId?: number | null;
  personId?: string | null;
  onCreated?: (taskId: number) => void;
};

export function CreateWorkflowTaskButton({
  label = "Create workflow task",
  defaultTitle = "",
  defaultDepartment = "campaign",
  defaultPriority = "medium",
  defaultStatus = "backlog",
  countyId = null,
  volunteerId = null,
  turfId = null,
  eventId = null,
  personId = null,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [department, setDepartment] = useState<Dept>(defaultDepartment);
  const [priority, setPriority] = useState<Priority>(defaultPriority);
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canCreate = useMemo(() => title.trim().length >= 4 && !busy, [title, busy]);

  async function create() {
    if (!canCreate) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/cm-hub/workflows/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          department,
          priority,
          status,
          countyId,
          volunteerId,
          turfId,
          eventId,
          personId,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: { taskId: number }; error?: string };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
      setOk(`Created task #${json.data.taskId}.`);
      onCreated?.(json.data.taskId);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTitle(defaultTitle);
          setDepartment(defaultDepartment);
          setPriority(defaultPriority);
          setStatus(defaultStatus);
          setErr(null);
          setOk(null);
          setOpen(true);
        }}
        className="rounded-2xl border border-sky-400/25 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-[28px] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Next action
                </p>
                <p className="mt-1 text-lg font-semibold">Create workflow task</p>
                <p className="mt-1 text-sm text-slate-400">
                  Keep it short and operational. Linkage is auto-filled from context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              {err ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                  {err}
                </div>
              ) : null}
              {ok ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  {ok}
                </div>
              ) : null}

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Schedule 3 county events this week"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-400/40"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Dept)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                  >
                    {[
                      "campaign",
                      "field",
                      "volunteers",
                      "events",
                      "comms",
                      "social",
                      "digital",
                      "fundraising",
                      "data",
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                  >
                    {(["low", "medium", "high", "critical"] as const).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Status)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                  >
                    {(["backlog", "ready", "in_progress", "blocked", "complete"] as const).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
                <p className="font-semibold text-white">Links</p>
                <p className="mt-1 text-slate-400">
                  countyId {countyId ?? "—"} · eventId {eventId ?? "—"} · volunteerId{" "}
                  {volunteerId ?? "—"} · turfId {turfId ?? "—"}
                  {" "}· personId {personId ?? "—"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={create}
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  Create task
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

