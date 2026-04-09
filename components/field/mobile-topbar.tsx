import type { ReactNode } from "react";

export function MobileTopBar({
  title,
  left,
  right,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">{left}</div>
        <div className="min-w-0 flex-[2] text-center text-sm font-semibold text-white">
          <span className="truncate">{title}</span>
        </div>
        <div className="min-w-0 flex-1 text-right">{right}</div>
      </div>
    </header>
  );
}

