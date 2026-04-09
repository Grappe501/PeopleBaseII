import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  subvalue?: ReactNode;
  tone?: "neutral" | "emerald" | "sky" | "violet" | "amber";
};

function toneClass(tone: Props["tone"]) {
  switch (tone) {
    case "emerald":
      return "border-emerald-400/15 bg-emerald-500/10";
    case "sky":
      return "border-sky-400/15 bg-sky-500/10";
    case "violet":
      return "border-violet-400/15 bg-violet-500/10";
    case "amber":
      return "border-amber-400/15 bg-amber-500/10";
    default:
      return "border-white/10 bg-slate-950/40";
  }
}

export function MetricCard({ label, value, subvalue, hint, tone = "neutral" }: Props) {
  return (
    <div className={`rounded-3xl border p-5 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          {label}
        </p>
        {hint ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      {subvalue ? <div className="mt-1 text-sm text-slate-300">{subvalue}</div> : null}
    </div>
  );
}

