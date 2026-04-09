import Link from "next/link";
import { headers } from "next/headers";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { DataReadinessBanner } from "@/components/site/data-readiness-banner";
import { TableShell } from "@/components/site/table-shell";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { SystemStatusPayload, SystemStatusTone } from "@/lib/types/contracts/system-status";

export const dynamic = "force-dynamic";

function toneLabel(tone: SystemStatusTone) {
  switch (tone) {
    case "success":
      return { pill: "success" as const, label: "Healthy" };
    case "warning":
      return { pill: "neutral" as const, label: "Partial" };
    case "danger":
      return { pill: "danger" as const, label: "Missing" };
    default:
      return { pill: "neutral" as const, label: "Unknown" };
  }
}

function bannerTone(tone: SystemStatusTone) {
  if (tone === "success") return "success" as const;
  if (tone === "warning") return "warning" as const;
  if (tone === "danger") return "danger" as const;
  return "neutral" as const;
}

async function loadStatus(): Promise<SystemStatusPayload | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/api/cm-hub/system-status`;

  const res = await fetch(url, {
    cache: "no-store",
  });
  const json = (await res.json()) as ApiResponse<SystemStatusPayload>;
  if (!json || json.success !== true) return null;
  return json.data;
}

export default async function SystemStatusPage() {
  const data = await loadStatus();
  const overall = data?.overallTone ?? "neutral";

  return (
    <>
      <SectionCard
        title="System status"
        description="Live readiness checks across domains (tables/views + key surfaces). This is the anti-silo scoreboard."
      >
        <DataReadinessBanner
          tone={bannerTone(overall)}
          title={`Overall: ${toneLabel(overall).label}`}
          details={
            data
              ? `Computed at ${new Date(data.computedAt).toLocaleString()}.`
              : "Could not load status (API error or DB unreachable)."
          }
          right={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/cm-hub"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
              >
                Back to CM Hub
              </Link>
              <a
                href="/api/cm-hub/system-status"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
              >
                View JSON
              </a>
            </div>
          }
        />
      </SectionCard>

      <SectionCard
        title="Domains"
        description="Green means the DB objects exist and core surfaces are wired. Yellow means partial. Red means missing."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {(data?.modules ?? []).map((m) => {
            const meta = toneLabel(m.tone);
            return (
              <div key={m.key} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{m.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{m.summary}</p>
                  </div>
                  <StatusPill tone={meta.pill}>{meta.label}</StatusPill>
                </div>

                {m.metrics && Object.keys(m.metrics).length ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {Object.entries(m.metrics).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-slate-200"
                      >
                        {k}: {v == null ? "—" : String(v)}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4">
                  <TableShell>
                    <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                      <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Check</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Expected</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {m.checks.map((c) => (
                          <tr key={c.key} className="bg-slate-900/40">
                            <td className="px-3 py-2 font-semibold text-white">{c.label}</td>
                            <td className="px-3 py-2 text-slate-300">{c.kind}</td>
                            <td className="px-3 py-2 text-slate-300">{c.expectedName}</td>
                            <td className="px-3 py-2">
                              <StatusPill tone={c.ok ? "success" : "danger"}>
                                {c.ok ? "OK" : "Missing"}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}

