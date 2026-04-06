'use client';

import { useState } from "react";

type AskResult = {
  prompt: string;
  answer: string;
};

export function AskPanel() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Ask request failed.");
      }

      setResult(payload.data);
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">Ask PeopleBase</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Safe shell for future AI-assisted analysis. Right now this routes into a
          guarded placeholder backend.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Compare Pulaski and Saline. Show me likely top opportunity counties. What should be in the AR-02 command view?"
          className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-sky-500/60"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Future mode: approved query modules + simulations + audited AI actions
          </p>
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Thinking..." : "Run"}
          </button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : result ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Response
            </p>
            <p className="text-sm text-slate-200">{result.answer}</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-400">
            <p>Try asking:</p>
            <ul className="space-y-2">
              <li>• Show me the counties with the largest voter footprint</li>
              <li>• Compare Pulaski and Saline</li>
              <li>• Build a turnout simulation module plan</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
