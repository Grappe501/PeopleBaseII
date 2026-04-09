import type { ReactNode } from "react";

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
      <div className="max-h-[min(620px,70vh)] overflow-auto">{children}</div>
    </div>
  );
}

