import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
};

export function ExpandableSection({
  title,
  description,
  defaultOpen,
  right,
  children,
}: Props) {
  return (
    <details
      className="group rounded-3xl border border-white/10 bg-slate-950/40 p-5"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {right ? <div className="hidden sm:block">{right}</div> : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            <span className="group-open:hidden">Expand</span>
            <span className="hidden group-open:inline">Collapse</span>
          </span>
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

