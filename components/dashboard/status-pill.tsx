import type { ReactNode } from "react";

type Tone = "success" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  neutral: "border-white/10 bg-white/5 text-slate-300",
};

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneStyles[tone]}`}
    >
      {children}
    </span>
  );
}
