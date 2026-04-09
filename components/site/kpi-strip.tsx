import type { ReactNode } from "react";

type Props = {
  items: Array<{
    label: string;
    value: ReactNode;
    tone?: "neutral" | "success" | "warning" | "danger";
  }>;
};

function itemTone(tone: Props["items"][number]["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-50";
    case "warning":
      return "border-amber-400/20 bg-amber-500/10 text-amber-50";
    case "danger":
      return "border-rose-400/20 bg-rose-500/10 text-rose-50";
    default:
      return "border-white/10 bg-white/5 text-white";
  }
}

export function KpiStrip({ items }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${itemTone(
            it.tone,
          )}`}
        >
          <span className="text-slate-200/80">{it.label}</span>{" "}
          <span className="text-white">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

