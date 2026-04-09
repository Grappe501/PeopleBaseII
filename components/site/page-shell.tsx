import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="kg-grain min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 md:px-10 md:py-12">
        {children}
      </div>
    </main>
  );
}

