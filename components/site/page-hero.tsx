import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  pills,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  pills?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-7 shadow-2xl shadow-black/35 md:p-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-emerald-500/14 via-sky-500/14 to-violet-500/14 blur-3xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300/80">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
          {description}
        </p>
      ) : null}
      {pills ? <div className="mt-5 flex flex-wrap gap-2">{pills}</div> : null}
      {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}

