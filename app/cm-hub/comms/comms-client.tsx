"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TableShell } from "@/components/site/table-shell";
import type { CommsQueueRow, CommsTemplateRow } from "@/lib/types/contracts/comms";

export function CommsClient() {
  const [templates, setTemplates] = useState<CommsTemplateRow[]>([]);
  const [queue, setQueue] = useState<CommsQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [personId, setPersonId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [tRes, qRes] = await Promise.all([
        fetch("/api/comms/templates", { cache: "no-store" }),
        fetch("/api/comms/queue?limit=40", { cache: "no-store" }),
      ]);
      const tJson = await tRes.json();
      const qJson = await qRes.json();
      if (!tJson.success) throw new Error(tJson.error ?? "templates");
      if (!qJson.success) throw new Error(qJson.error ?? "queue");
      setTemplates(tJson.data.rows);
      setQueue(qJson.data.rows);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraft() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/comms/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: personId.trim(),
          channel,
          templateKey: templateKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "create failed");
      setPersonId("");
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function action(id: number, path: string, body?: object) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/comms/queue/${id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? path);
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {err}
        </div>
      ) : null}

      <div className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 md:p-6">
        <h2 className="text-lg font-semibold text-white">New message (draft)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Paste a Person UUID and pick a template. Flow: draft → submit → approve → send (SendGrid email /
          Twilio SMS from env — see <code className="text-slate-300">env.example</code>). Sends resolve the
          recipient from <code className="text-slate-300">person_contact_methods</code> and write{" "}
          <code className="text-slate-300">compliance_message_log</code>.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Person ID
            <input
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              placeholder="uuid"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "email" | "sms")}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            >
              <option value="email">email</option>
              <option value="sms">sms</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Template
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            >
              <option value="">— custom later —</option>
              {templates.map((t) => (
                <option key={t.templateKey} value={t.templateKey}>
                  {t.name} ({t.channel})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !personId.trim() || !templateKey}
            onClick={() => void createDraft()}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
          >
            Create draft from template
          </button>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300">
            Find a person via header search
          </span>
        </div>
      </div>

      <div className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Templates</h2>
            <p className="mt-1 text-sm text-slate-400">Seeded + upsert via API.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4">
          <TableShell>
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-slate-400">
                      No templates (run migration 037).
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.templateKey} className="bg-slate-900/40">
                      <td className="px-3 py-2 font-mono text-xs text-slate-200">{t.templateKey}</td>
                      <td className="px-3 py-2 text-white">{t.name}</td>
                      <td className="px-3 py-2 text-slate-300">{t.channel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </div>
      </div>

      <div className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 md:p-6">
        <h2 className="text-lg font-semibold text-white">Queue & approvals</h2>
        <p className="mt-1 text-sm text-slate-400">
          Webhooks: POST <code className="text-slate-300">/api/comms/webhooks/sendgrid</code> and{" "}
          <code className="text-slate-300">/api/comms/webhooks/twilio</code> (store-only).
        </p>
        <div className="mt-4">
          <TableShell>
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Ch</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-slate-400">
                      No queue rows yet.
                    </td>
                  </tr>
                ) : (
                  queue.map((q) => (
                    <tr key={q.id} className="bg-slate-900/40">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-200">
                        {q.id}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2">
                        <Link className="text-sky-200 hover:underline" href={`/people/${q.personId}`}>
                          {q.personId}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{q.channel}</td>
                      <td className="px-3 py-2 text-slate-200">{q.status}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {q.status === "draft" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void action(q.id, "submit")}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10"
                            >
                              Submit
                            </button>
                          ) : null}
                          {q.status === "pending_approval" ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void action(q.id, "approve", { approvedBy: "cm-hub-ui" })}
                                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  const reason = window.prompt("Rejection reason?");
                                  if (reason) void action(q.id, "reject", { reason });
                                }}
                                className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {q.status === "approved" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void action(q.id, "send")}
                              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-100"
                            >
                              Send
                            </button>
                          ) : null}
                          {q.complianceMessageLogId ? (
                            <span className="text-[11px] text-slate-500">
                              log #{q.complianceMessageLogId}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </div>
      </div>
    </div>
  );
}
