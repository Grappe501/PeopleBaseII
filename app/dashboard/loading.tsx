export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-12 w-80 rounded-xl bg-slate-800" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-900" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.5fr_420px]">
            <div className="h-[520px] rounded-2xl bg-slate-900" />
            <div className="h-[520px] rounded-2xl bg-slate-900" />
          </div>
        </div>
      </div>
    </main>
  );
}
