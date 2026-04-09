"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  WorkflowBoardPayload,
  WorkflowCreateTaskInput,
  WorkflowTaskRow,
  WorkflowTaskStatus,
} from "@/lib/types/contracts/cm-hub-workflows";

const STATUSES: Array<{ k: WorkflowTaskStatus; label: string }> = [
  { k: "backlog", label: "Backlog" },
  { k: "ready", label: "Ready" },
  { k: "in_progress", label: "In progress" },
  { k: "blocked", label: "Blocked" },
  { k: "complete", label: "Complete" },
];

async function getBoard(): Promise<WorkflowBoardPayload> {
  const res = await fetch("/api/cm-hub/workflows/board", { cache: "no-store" });
  const json = (await res.json()) as { success: boolean; data?: WorkflowBoardPayload; error?: string };
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
}

type CountyLookupRow = { countyId: number; countyName: string };
type VolunteerLookupRow = { volunteerId: number; name: string; countyName: string | null };
type TurfLookupRow = { turfId: number; turfName: string; countyName: string | null };
type DependencyRow = { dependsOnTaskId: number; title: string; status: string };

async function getLookup<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as { success: boolean; data?: { rows: T[] }; error?: string };
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data.rows;
}

async function getTaskDependencies(taskId: number): Promise<DependencyRow[]> {
  const res = await fetch(`/api/cm-hub/workflows/tasks/${taskId}/dependencies`, { cache: "no-store" });
  const json = (await res.json()) as { success: boolean; data?: { rows: DependencyRow[] }; error?: string };
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data.rows;
}

function TaskCard({
  t,
  onMove,
  onOpen,
}: {
  t: WorkflowTaskRow;
  onMove: (id: number, status: WorkflowTaskStatus) => void;
  onOpen: (t: WorkflowTaskRow) => void;
}) {
  const blocked = t.isBlockedByDependencies && t.status !== "complete";
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => onOpen(t)} className="w-full text-left">
            <p className="truncate font-semibold text-white hover:underline">{t.title}</p>
          </button>
          <p className="mt-1 text-xs text-slate-500">
            {t.department} {t.owner ? `• ${t.owner}` : ""} {t.countyName ? `• ${t.countyName}` : ""}
          </p>
          {blocked ? (
            <p className="mt-2 text-xs text-amber-200">
              Blocked by {t.incompleteDependencyCount}/{t.dependencyCount} dependency
              {t.dependencyCount === 1 ? "" : "ies"}.
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
          {t.priority}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["ready", "in_progress", "complete"] as WorkflowTaskStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => onMove(t.id, s)}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            {s === "in_progress" ? "Start" : s === "ready" ? "Ready" : "Complete"}
          </button>
        ))}
      </div>

      {t.turfId || t.volunteerId ? (
        <p className="mt-3 text-xs text-slate-500">
          Links:{" "}
          {t.turfId ? <span className="text-slate-300">turf #{t.turfId}</span> : null}
          {t.turfId && t.volunteerId ? <span className="text-slate-600"> · </span> : null}
          {t.volunteerId ? <span className="text-slate-300">volunteer #{t.volunteerId}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function WorkflowsClient() {
  const [board, setBoard] = useState<WorkflowBoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [drawerTask, setDrawerTask] = useState<WorkflowTaskRow | null>(null);
  const [deps, setDeps] = useState<DependencyRow[]>([]);
  const [counties, setCounties] = useState<CountyLookupRow[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerLookupRow[]>([]);
  const [turfs, setTurfs] = useState<TurfLookupRow[]>([]);
  const [allTasks, setAllTasks] = useState<WorkflowTaskRow[]>([]);
  const [depToAdd, setDepToAdd] = useState<string>("");
  const [countyPick, setCountyPick] = useState<string>("");
  const [volunteerPick, setVolunteerPick] = useState<string>("");
  const [turfPick, setTurfPick] = useState<string>("");

  async function refresh() {
    setError(null);
    const b = await getBoard();
    setBoard(b);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  const total = useMemo(() => {
    if (!board) return 0;
    return Object.values(board.columns).reduce((acc, col) => acc + col.length, 0);
  }, [board]);

  async function createTask() {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const payload: WorkflowCreateTaskInput = { title: t, department: "campaign", priority: "medium", status: "backlog" };
      await postJson("/api/cm-hub/workflows/tasks", payload);
      setTitle("");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function moveTask(id: number, status: WorkflowTaskStatus) {
    setBusy(true);
    try {
      await patchJson(`/api/cm-hub/workflows/tasks/${id}`, { status });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openDrawer(t: WorkflowTaskRow) {
    setDrawerTask(t);
    setDepToAdd("");
    setCountyPick(t.countyId != null ? String(t.countyId) : "");
    setVolunteerPick(t.volunteerId != null ? String(t.volunteerId) : "");
    setTurfPick(t.turfId != null ? String(t.turfId) : "");
    try {
      const [depRows, cRows, vRows, tRows, taskList] = await Promise.all([
        getTaskDependencies(t.id),
        getLookup<CountyLookupRow>("/api/cm-hub/lookups/counties"),
        getLookup<VolunteerLookupRow>("/api/cm-hub/lookups/volunteers"),
        getLookup<TurfLookupRow>("/api/cm-hub/lookups/turfs"),
        (async () => {
          const res = await fetch("/api/cm-hub/workflows/tasks?limit=250", { cache: "no-store" });
          const json = (await res.json()) as { success: boolean; data?: { rows: WorkflowTaskRow[] }; error?: string };
          if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
          return json.data.rows;
        })(),
      ]);
      setDeps(depRows);
      setCounties(cRows);
      setVolunteers(vRows);
      setTurfs(tRows);
      setAllTasks(taskList);
    } catch (e) {
      setError(String(e));
    }
  }

  async function updateLinks(next: Partial<WorkflowTaskRow>) {
    if (!drawerTask) return;
    setBusy(true);
    try {
      await patchJson(`/api/cm-hub/workflows/tasks/${drawerTask.id}`, {
        countyId: next.countyId ?? null,
        volunteerId: next.volunteerId ?? null,
        turfId: next.turfId ?? null,
      });
      await refresh();
      const updated = (board ? Object.values(board.columns).flat() : []).find((x) => x.id === drawerTask.id) ?? drawerTask;
      setDrawerTask({ ...updated, ...next });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function parseOptionalId(raw: string): number | null {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function applyLinks() {
    if (!drawerTask) return;
    await updateLinks({
      countyId: parseOptionalId(countyPick),
      volunteerId: parseOptionalId(volunteerPick),
      turfId: parseOptionalId(turfPick),
    });
  }

  async function addDependency() {
    if (!drawerTask) return;
    const dependsOnTaskId = Number(depToAdd);
    if (!Number.isFinite(dependsOnTaskId) || dependsOnTaskId <= 0) return;
    setBusy(true);
    try {
      await postJson("/api/cm-hub/workflows/dependencies", {
        taskId: drawerTask.id,
        dependsOnTaskId,
      });
      const depRows = await getTaskDependencies(drawerTask.id);
      setDeps(depRows);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeDependency(dependsOnTaskId: number) {
    if (!drawerTask) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cm-hub/workflows/dependencies", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: drawerTask.id, dependsOnTaskId }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      const depRows = await getTaskDependencies(drawerTask.id);
      setDeps(depRows);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          {board ? (
            <>
              Loaded <span className="font-semibold text-white">{total}</span> tasks.
            </>
          ) : (
            "Loading tasks…"
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task title…"
            className="w-72 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
          />
          <button
            disabled={busy}
            onClick={createTask}
            className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
          >
            Add
          </button>
          <button
            disabled={busy}
            onClick={() => refresh().catch((e) => setError(String(e)))}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        {STATUSES.map((s) => (
          <div key={s.k} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              {s.label}
            </p>
            <div className="mt-3 space-y-3">
              {(board?.columns[s.k] ?? []).map((t) => (
                <TaskCard key={t.id} t={t} onMove={moveTask} onOpen={openDrawer} />
              ))}
              {(board?.columns[s.k] ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-3 text-xs text-slate-500">
                  Empty
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {drawerTask ? (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-4xl rounded-t-[28px] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Task #{drawerTask.id}
                </p>
                <p className="mt-1 truncate text-lg font-semibold">{drawerTask.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {drawerTask.department} {drawerTask.owner ? `• ${drawerTask.owner}` : ""}
                </p>
              </div>
              <button
                onClick={() => setDrawerTask(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Link to real objects
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  One-click linking enforces “no silos.”
                </p>

                <label className="mt-4 block text-xs text-slate-500">County</label>
                <input
                  value={countyPick}
                  onChange={(e) => setCountyPick(e.target.value)}
                  list="cmhub-county-list"
                  placeholder="Type to search… (id)"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                />
                <datalist id="cmhub-county-list">
                  {counties.map((c) => (
                    <option key={c.countyId} value={String(c.countyId)}>
                      {c.countyName}
                    </option>
                  ))}
                </datalist>

                <label className="mt-4 block text-xs text-slate-500">Volunteer</label>
                <input
                  value={volunteerPick}
                  onChange={(e) => setVolunteerPick(e.target.value)}
                  list="cmhub-volunteer-list"
                  placeholder="Type to search… (id)"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                />
                <datalist id="cmhub-volunteer-list">
                  {volunteers.map((v) => (
                    <option key={v.volunteerId} value={String(v.volunteerId)}>
                      {v.name}{v.countyName ? ` (${v.countyName})` : ""}
                    </option>
                  ))}
                </datalist>

                <label className="mt-4 block text-xs text-slate-500">Turf</label>
                <input
                  value={turfPick}
                  onChange={(e) => setTurfPick(e.target.value)}
                  list="cmhub-turf-list"
                  placeholder="Type to search… (id)"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                />
                <datalist id="cmhub-turf-list">
                  {turfs.map((t) => (
                    <option key={t.turfId} value={String(t.turfId)}>
                      {t.turfName}{t.countyName ? ` (${t.countyName})` : ""}
                    </option>
                  ))}
                </datalist>

                <div className="mt-4 flex justify-end">
                  <button
                    disabled={busy}
                    onClick={applyLinks}
                    className="rounded-2xl border border-sky-400/25 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-60"
                  >
                    Apply links
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Dependencies
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  A task is blocked until all dependencies are complete.
                </p>

                <label className="mt-4 block text-xs text-slate-500">Add dependency</label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={depToAdd}
                    onChange={(e) => setDepToAdd(e.target.value)}
                    list="cmhub-task-list"
                    placeholder="Type to search… (id)"
                    className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                  />
                  <datalist id="cmhub-task-list">
                    {allTasks
                      .filter((t) => t.id !== drawerTask.id)
                      .map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          #{t.id} {t.title}
                        </option>
                      ))}
                  </datalist>
                  <button
                    disabled={busy || !depToAdd}
                    onClick={addDependency}
                    className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {deps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-3 text-xs text-slate-500">
                      No dependencies.
                    </div>
                  ) : (
                    deps.map((d) => (
                      <div
                        key={d.dependsOnTaskId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            #{d.dependsOnTaskId} {d.title}
                          </p>
                          <p className="text-xs text-slate-500">Status: {d.status}</p>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => removeDependency(d.dependsOnTaskId)}
                          className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

