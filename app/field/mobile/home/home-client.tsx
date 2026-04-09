"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CurrentSessionPayload = {
  volunteerId: number;
  session: { sessionId: number; turfId: number | null; turfName: string | null; startedAt: string } | null;
};

export function HomeClient() {
  const [data, setData] = useState<CurrentSessionPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/field/mobile/session/current", { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: CurrentSessionPayload };
        if (!cancelled && json.success && json.data) setData(json.data);
      } catch {
        // ignore; home still usable offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resumeHref =
    data?.session?.turfId != null ? `/field/mobile/turf/${data.session.turfId}/live` : null;

  return (
    <div className="mt-4 grid gap-3">
      {resumeHref ? (
        <Link
          href={resumeHref}
          className="rounded-2xl border border-sky-400/25 bg-sky-500/15 px-4 py-3 text-center text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
        >
          Resume current session
        </Link>
      ) : null}
      <Link
        href="/field/mobile/turf"
        className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-3 text-center text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
      >
        Start turf
      </Link>
      <Link
        href="/field/mobile/checkin"
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
      >
        Shift check-in
      </Link>
    </div>
  );
}

