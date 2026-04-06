import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
