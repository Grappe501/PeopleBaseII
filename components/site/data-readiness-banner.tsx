import type { ReactNode } from "react";

type Tone = "neutral" | "warning" | "danger" | "success";

type Props = {
  tone?: Tone;
  title: string;
  details?: string;
  right?: ReactNode;
};

function toneClasses(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-50";
    case "warning":
      return "border-amber-400/20 bg-amber-500/10 text-amber-50";
    case "danger":
      return "border-rose-400/20 bg-rose-500/10 text-rose-50";
    default:
      return "border-white/10 bg-slate-950/40 text-white";
  }
}

export function DataReadinessBanner({ tone = "neutral", title, details, right }: Props) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-4 rounded-3xl border p-5 ${toneClasses(
        tone,
      )}`}
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {details ? <p className="mt-1 text-sm leading-6 text-slate-300/80">{details}</p> : null}
      </div>
      {right ? <div className="flex flex-wrap gap-2">{right}</div> : null}
    </div>
  );
}

