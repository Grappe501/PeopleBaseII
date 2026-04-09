"use client";

import { useEffect, useMemo, useState } from "react";

type LatestResponse = {
  success: boolean;
  data?: { latest: any };
  error?: string;
};

type SaveResponse = {
  success: boolean;
  data?: { saved: any };
  error?: string;
};

export function CmAgentOnboardingClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [campaignPhilosophy, setCampaignPhilosophy] = useState("");
  const [focuses, setFocuses] = useState("");
  const [prioritiesJson, setPrioritiesJson] = useState(
    JSON.stringify(
      {
        topPriorities: [],
        timeHorizon: "next_7_days",
        nonNegotiables: [],
      },
      null,
      2,
    ),
  );
  const [styleGuide, setStyleGuide] = useState("");
  const [decisionRules, setDecisionRules] = useState("");
  const [weeklyHoursAvailable, setWeeklyHoursAvailable] = useState<string>("10");
  const [preferredCheckinCadence, setPreferredCheckinCadence] = useState("daily");
  const [constraints, setConstraints] = useState(
    "Do not do person-level partisan targeting. Stay nonpartisan at the individual level. Protect privacy and morale.",
  );
  const [agentRoutingNotes, setAgentRoutingNotes] = useState(
    "CM agent informs all role agents when decisions change; translates decisions into tasks + owners + deadlines.",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch("/api/cm-hub/cm-agent/onboarding", { cache: "no-store" });
        const json = (await res.json()) as LatestResponse;
        if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
        const latest = json.data?.latest;
        if (!latest || cancelled) return;

        setCampaignPhilosophy(latest.campaignPhilosophy ?? "");
        setFocuses(latest.focuses ?? "");
        setStyleGuide(latest.styleGuide ?? "");
        setDecisionRules(latest.decisionRules ?? "");
        setWeeklyHoursAvailable(
          latest.weeklyHoursAvailable != null ? String(latest.weeklyHoursAvailable) : "10",
        );
        setPreferredCheckinCadence(latest.preferredCheckinCadence ?? "daily");
        setConstraints(latest.constraints ?? "");
        setAgentRoutingNotes(latest.agentRoutingNotes ?? "");
        setPrioritiesJson(
          latest.prioritiesJson != null ? JSON.stringify(latest.prioritiesJson, null, 2) : prioritiesJson,
        );
        setSavedAt(latest.updatedAt ?? null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedPriorities = useMemo(() => {
    try {
      return JSON.parse(prioritiesJson);
    } catch {
      return null;
    }
  }, [prioritiesJson]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (parsedPriorities === null) throw new Error("Priorities JSON is invalid.");
      const body = {
        campaignPhilosophy: campaignPhilosophy.trim() || null,
        focuses: focuses.trim() || null,
        prioritiesJson: parsedPriorities,
        styleGuide: styleGuide.trim() || null,
        decisionRules: decisionRules.trim() || null,
        weeklyHoursAvailable: weeklyHoursAvailable.trim()
          ? Number(weeklyHoursAvailable)
          : null,
        preferredCheckinCadence: preferredCheckinCadence.trim() || null,
        constraints: constraints.trim() || null,
        agentRoutingNotes: agentRoutingNotes.trim() || null,
      };

      const res = await fetch("/api/cm-hub/cm-agent/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as SaveResponse;
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSavedAt(json.data?.saved?.updatedAt ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-300">
          Loading onboarding…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Philosophy
          </p>
          <textarea
            value={campaignPhilosophy}
            onChange={(e) => setCampaignPhilosophy(e.target.value)}
            rows={6}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            placeholder="What do we believe? What do we protect? How do we treat volunteers and voters?"
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Focuses (near-term)
          </p>
          <textarea
            value={focuses}
            onChange={(e) => setFocuses(e.target.value)}
            rows={6}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            placeholder="What are we focusing on this week/month? What gets deprioritized?"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Priorities (JSON)
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Structured priorities so the CM agent can translate decisions into tasks consistently.
          </p>
          <textarea
            value={prioritiesJson}
            onChange={(e) => setPrioritiesJson(e.target.value)}
            rows={10}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
          />
          {parsedPriorities === null ? (
            <p className="mt-2 text-xs text-rose-200">Invalid JSON</p>
          ) : (
            <p className="mt-2 text-xs text-emerald-200">Valid JSON</p>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Style + decision rules
          </p>
          <textarea
            value={styleGuide}
            onChange={(e) => setStyleGuide(e.target.value)}
            rows={4}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            placeholder="Tone, writing style, how to talk to volunteers, how to keep morale protected."
          />
          <textarea
            value={decisionRules}
            onChange={(e) => setDecisionRules(e.target.value)}
            rows={4}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            placeholder="Decision rules: what we never do, how we resolve disagreements, escalation thresholds."
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Availability
          </p>
          <label className="mt-3 block text-xs text-slate-500">Hours/week</label>
          <input
            value={weeklyHoursAvailable}
            onChange={(e) => setWeeklyHoursAvailable(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
          />
          <label className="mt-4 block text-xs text-slate-500">Check-in cadence</label>
          <input
            value={preferredCheckinCadence}
            onChange={(e) => setPreferredCheckinCadence(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
            placeholder="daily / weekly / ad-hoc"
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Constraints + agent routing
          </p>
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            rows={4}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            placeholder="Legal/safety constraints, campaign rules, privacy rules."
          />
          <textarea
            value={agentRoutingNotes}
            onChange={(e) => setAgentRoutingNotes(e.target.value)}
            rows={4}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            placeholder="How the CM agent coordinates other agents and turns decisions into tasks."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {savedAt ? (
            <>
              Last saved: <span className="text-slate-300">{savedAt}</span>
            </>
          ) : (
            "Not saved yet."
          )}
        </p>
        <button
          disabled={busy || parsedPriorities === null}
          onClick={save}
          className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save onboarding"}
        </button>
      </div>
    </div>
  );
}

