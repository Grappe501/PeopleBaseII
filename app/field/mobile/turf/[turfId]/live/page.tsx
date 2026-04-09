import { MobileTopBar } from "@/components/field/mobile-topbar";
import { LiveClient } from "@/app/field/mobile/turf/[turfId]/live/live-client";

export const dynamic = "force-dynamic";

export default async function TurfLivePage({
  params,
}: {
  params: Promise<{ turfId: string }>;
}) {
  const { turfId } = await params;
  const turfIdNum = Number(turfId);
  return (
    <>
      <MobileTopBar
        title="Canvassing"
        left={<span className="text-xs text-slate-400">{turfId}</span>}
        right={<span className="text-xs text-emerald-300/90">Synced</span>}
      />
      {Number.isFinite(turfIdNum) && turfIdNum > 0 ? (
        <LiveClient turfId={turfIdNum} />
      ) : (
        <div className="px-4 py-5">
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
            Invalid turf id.
          </div>
        </div>
      )}
    </>
  );
}

