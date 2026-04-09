import type { ReactNode } from "react";

export function EventCard({
  title,
  when,
  locationLine,
  description,
  badges,
  actions,
}: {
  title: string;
  when: string;
  locationLine?: string | null;
  description?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {when}
            {locationLine ? ` · ${locationLine}` : ""}
          </p>
          {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
          {actions ? <div className="mt-3 flex flex-wrap gap-2 text-xs">{actions}</div> : null}
        </div>
        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
      </div>
    </div>
  );
}

