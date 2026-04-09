"use client";

import { useMemo, useState } from "react";
import { MetricCard } from "@/components/site/metric-card";
import { ExpandableSection } from "@/components/site/expandable-section";

type CallContact = {
  id: string;
  name: string;
  relationshipStrength: number; // 0-100
  likelihoodToGive: number; // 0-100
  suggestedAskAmount: number;
  totalGiven: number;
  averageGift: number;
  lastDonationAt: string | null;
  lastContactAt: string | null;
  notes: string[];
};

type CallOutcome =
  | "pledged"
  | "donated"
  | "follow_up"
  | "no_answer"
  | "not_a_fit";

function fmtMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function rankScore(c: CallContact): number {
  // Deterministic “AI-ranked” heuristic for MVP:
  // prioritize high likelihood, high relationship, and recency (if last donation exists).
  const likelihood = c.likelihoodToGive / 100;
  const relationship = c.relationshipStrength / 100;
  const value = clamp01(Math.log10(Math.max(1, c.totalGiven)) / 4); // gently saturate
  const recency = (() => {
    if (!c.lastDonationAt) return 0.2;
    const days = (Date.now() - new Date(c.lastDonationAt).getTime()) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(days)) return 0.2;
    return clamp01(1 - Math.min(365, Math.max(0, days)) / 365);
  })();
  return 100 * (0.42 * likelihood + 0.30 * relationship + 0.18 * recency + 0.10 * value);
}

function generateScript(c: CallContact): {
  openingLine: string;
  personalHook: string;
  ask: string;
  fallbackAsk: string;
  objections: string[];
} {
  const ask = c.suggestedAskAmount;
  const fallback = Math.max(25, Math.round(ask * 0.6));

  return {
    openingLine: `Hi ${c.name.split(" ")[0]} — it’s Kelly. Do you have a quick minute?`,
    personalHook: c.notes[0] ?? "I wanted to personally thank you for being part of this.",
    ask: `I’m calling because we’re building the statewide civic engagement operation. Would you consider a contribution of ${fmtMoney(
      ask,
    )} today to help us scale organizers and the county system?`,
    fallbackAsk: `If that’s not comfortable, would ${fmtMoney(fallback)} be doable today?`,
    objections: [
      "Totally understand. What would feel comfortable right now?",
      "If timing is the issue, can I follow up next week after you’ve had a chance to think about it?",
      "Would you be open to a monthly pledge instead, even at a smaller level?",
    ],
  };
}

const DEMO_CONTACTS: CallContact[] = [
  {
    id: "ct_001",
    name: "Patricia Johnson",
    relationshipStrength: 82,
    likelihoodToGive: 74,
    suggestedAskAmount: 250,
    totalGiven: 900,
    averageGift: 150,
    lastDonationAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    lastContactAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    notes: ["Met at Pulaski fundraiser; cares about election integrity and transparency."],
  },
  {
    id: "ct_002",
    name: "Michael Reed",
    relationshipStrength: 64,
    likelihoodToGive: 68,
    suggestedAskAmount: 100,
    totalGiven: 300,
    averageGift: 100,
    lastDonationAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    lastContactAt: new Date(Date.now() - 140 * 86400000).toISOString(),
    notes: ["Friend-of-friend; responds well to concrete goals and timelines."],
  },
  {
    id: "ct_003",
    name: "Sarah Bennett",
    relationshipStrength: 55,
    likelihoodToGive: 61,
    suggestedAskAmount: 75,
    totalGiven: 75,
    averageGift: 75,
    lastDonationAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    lastContactAt: null,
    notes: ["New donor; follow up quickly while momentum is high."],
  },
  {
    id: "ct_004",
    name: "David Nguyen",
    relationshipStrength: 70,
    likelihoodToGive: 58,
    suggestedAskAmount: 500,
    totalGiven: 1500,
    averageGift: 500,
    lastDonationAt: new Date(Date.now() - 210 * 86400000).toISOString(),
    lastContactAt: new Date(Date.now() - 220 * 86400000).toISOString(),
    notes: ["Strong capacity; prefers direct asks and clear ROI."],
  },
  {
    id: "ct_005",
    name: "Maria Thompson",
    relationshipStrength: 48,
    likelihoodToGive: 52,
    suggestedAskAmount: 50,
    totalGiven: 100,
    averageGift: 50,
    lastDonationAt: null,
    lastContactAt: null,
    notes: ["Potential first-time donor; start small and invite to an event."],
  },
];

export function CallTimeClient() {
  const [callsGoal] = useState(25);
  const [dollarsGoal] = useState(12000);
  const [timeGoalHours] = useState(2);

  const [q, setQ] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, CallOutcome>>({});

  const ranked = useMemo(() => {
    const x = q.trim().toLowerCase();
    const base = DEMO_CONTACTS.filter((c) => (x ? c.name.toLowerCase().includes(x) : true)).map(
      (c) => ({
        c,
        score: rankScore(c),
      }),
    );
    base.sort((a, b) => b.score - a.score);
    return base;
  }, [q]);

  const [activeId, setActiveId] = useState<string>(ranked[0]?.c.id ?? DEMO_CONTACTS[0]!.id);
  const active = useMemo(
    () => DEMO_CONTACTS.find((c) => c.id === activeId) ?? DEMO_CONTACTS[0]!,
    [activeId],
  );

  const stats = useMemo(() => {
    const vals = Object.values(outcomes);
    const completed = vals.length;
    const donated = vals.filter((v) => v === "donated").length;
    const pledged = vals.filter((v) => v === "pledged").length;
    const followups = vals.filter((v) => v === "follow_up").length;
    const noAnswer = vals.filter((v) => v === "no_answer").length;
    return { completed, donated, pledged, followups, noAnswer };
  }, [outcomes]);

  const script = useMemo(() => generateScript(active), [active]);

  function setOutcome(outcome: CallOutcome) {
    setOutcomes((prev) => ({ ...prev, [active.id]: outcome }));
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Today’s goal" value={`${callsGoal} calls`} subvalue={`${timeGoalHours} hours scheduled`} tone="sky" />
        <MetricCard label="Dollars target" value={fmtMoney(dollarsGoal)} subvalue="Fundraising sprint" tone="emerald" />
        <MetricCard
          label="Progress"
          value={`${stats.completed}/${callsGoal}`}
          subvalue={`${stats.donated} donated · ${stats.pledged} pledged · ${stats.followups} follow-up`}
          tone="violet"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <div className="rounded-[26px] border border-white/10 bg-slate-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Call list (ranked)</p>
              <p className="mt-1 text-sm text-slate-400">
                The top of the list is “highest ROI today” based on likelihood, relationship, and recency.
              </p>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name…"
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-400/40"
            />
          </div>

          <div className="max-h-[min(520px,70vh)] overflow-auto p-2">
            {ranked.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">No matches.</div>
            ) : (
              <ul className="grid gap-2">
                {ranked.map(({ c, score }) => {
                  const isActive = c.id === activeId;
                  const outcome = outcomes[c.id];
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={`w-full rounded-3xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-sky-400/30 bg-sky-500/10"
                            : "border-white/10 bg-slate-900/40 hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{c.name}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              Total {fmtMoney(c.totalGiven)} · Avg {fmtMoney(c.averageGift)} · Last gift {fmtWhen(c.lastDonationAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                              Score {score.toFixed(0)}
                            </span>
                            {outcome ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                                {outcome.replaceAll("_", " ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-slate-300">
                            Relationship <span className="font-semibold text-white">{c.relationshipStrength}</span>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-slate-300">
                            Likelihood <span className="font-semibold text-white">{c.likelihoodToGive}</span>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-slate-300">
                            Ask <span className="font-semibold text-white">{fmtMoney(c.suggestedAskAmount)}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-slate-950/30">
          <div className="border-b border-white/10 p-4">
            <p className="text-sm font-semibold text-white">Active call</p>
            <p className="mt-1 text-sm text-slate-400">
              Click outcomes after the call. This will become the training signal for scripts and rankings.
            </p>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{active.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Last gift {fmtWhen(active.lastDonationAt)} · Last contact {fmtWhen(active.lastContactAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOutcome("donated")}
                    className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Donated
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome("pledged")}
                    className="rounded-2xl border border-sky-400/25 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
                  >
                    Pledged
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome("follow_up")}
                    className="rounded-2xl border border-amber-400/25 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                  >
                    Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome("no_answer")}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    No answer
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total given</p>
                  <p className="mt-1 text-sm font-semibold text-white">{fmtMoney(active.totalGiven)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Suggested ask</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {fmtMoney(active.suggestedAskAmount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Likelihood</p>
                  <p className="mt-1 text-sm font-semibold text-white">{active.likelihoodToGive}/100</p>
                </div>
              </div>
            </div>

            <ExpandableSection
              title="AI script generator (MVP)"
              description="Fast, consistent structure: opening → hook → ask → fallback → objections."
              defaultOpen
            >
              <div className="space-y-3 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Opening line
                  </p>
                  <p className="mt-1">{script.openingLine}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Personal hook
                  </p>
                  <p className="mt-1">{script.personalHook}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Ask
                  </p>
                  <p className="mt-1">{script.ask}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Fallback ask
                  </p>
                  <p className="mt-1">{script.fallbackAsk}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Objection handling
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                    {script.objections.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Relationship notes" description="Quick context to personalize the first 10 seconds.">
              <ul className="space-y-2 text-sm text-slate-300">
                {active.notes.map((n) => (
                  <li key={n} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                    {n}
                  </li>
                ))}
              </ul>
            </ExpandableSection>
          </div>
        </div>
      </div>
    </div>
  );
}

