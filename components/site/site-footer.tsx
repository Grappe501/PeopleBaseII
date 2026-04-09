export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
          <p className="text-slate-400">
            People over politics. Always. Built to serve all 75 counties with transparency.
          </p>
          <p className="text-slate-500">
            Contact <span className="text-slate-300">kelly@kellygrappe.com</span>
          </p>
        </div>
        <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Paid for by The Committee to Elect Kelly Grappe Arkansas Secretary of State
        </p>
      </div>
    </footer>
  );
}

