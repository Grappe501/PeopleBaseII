import { MobileTopBar } from "@/components/field/mobile-topbar";
import { TurfListClient } from "@/app/field/mobile/turf/turf-list-client";

export const dynamic = "force-dynamic";

export default function FieldTurfListPage() {
  return (
    <>
      <MobileTopBar
        title="Turf"
        left={<span className="text-xs text-slate-400">My turfs</span>}
        right={<span className="text-xs text-slate-400">Live</span>}
      />
      <TurfListClient />
    </>
  );
}

