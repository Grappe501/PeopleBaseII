"use client";

import { useMemo, useState } from "react";

type AskApiResponse = {
  success: boolean;
  data?: {
    prompt: string;
    reportId?: string;
    reportTitle?: string;
    answer: string;
    reportPayload?: unknown;
  };
  error?: string;
};

export function ReportsAgentPanel({
  contextLabel = "Reports Agent",
  defaultPrompt = "",
}: {
  contextLabel?: string;
  defaultPrompt?: string;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ reportTitle?: string; reportId?: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const canAsk = useMemo(() => prompt.trim().length >= 4 && !busy, [prompt, busy]);

  async function ask() {
    if (!canAsk) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json()) as AskApiResponse;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setMeta({ reportTitle: json.data.reportTitle, reportId: json.data.reportId });
      setAnswer(json.data.answer);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] rounded-full border border-sky-400/25 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100 shadow-lg shadow-black/30 hover:bg-sky-500/20"
      >
        Reports Agent
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-[28px] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  {contextLabel}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Ask in plain language. Outputs are constrained to approved report modules.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Ask: 'Which counties are falling behind?'"
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {meta?.reportTitle ? (
                    <>
                      Report: <span className="text-slate-300">{meta.reportTitle}</span>{" "}
                      {meta.reportId ? (
                        <span className="text-slate-600">({meta.reportId})</span>
                      ) : null}
                    </>
                  ) : (
                    "Tip: keep prompts short and operational."
                  )}
                </p>
                <button
                  disabled={!canAsk}
                  onClick={ask}
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  {busy ? "Running…" : "Run report"}
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              {answer ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
                  <pre className="whitespace-pre-wrap font-sans">{answer}</pre>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                  No output yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

