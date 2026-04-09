import sql from "@/lib/db";
import type { DeliverabilityThresholdRow } from "@/lib/types/contracts/deliverability";

function iso(d: Date | string | null): string | null {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

/** Active deliverability thresholds for orchestration, preflight, and incident workers. */
export async function listDeliverabilityThresholds(activeOnly = true): Promise<DeliverabilityThresholdRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      channel: string;
      threshold_key: string;
      warning_value: string | null;
      critical_value: string | null;
      active: boolean;
      updated_at: Date | string;
    }>
  >`
    select id, channel, threshold_key, warning_value, critical_value, active, updated_at
    from public.deliverability_threshold_configs
    where (not ${activeOnly} or active = true)
    order by channel asc, threshold_key asc
  `;

  return rows.map((r) => ({
    id: r.id,
    channel: r.channel as DeliverabilityThresholdRow["channel"],
    thresholdKey: r.threshold_key,
    warningValue: r.warning_value != null ? Number(r.warning_value) : null,
    criticalValue: r.critical_value != null ? Number(r.critical_value) : null,
    active: r.active,
    updatedAt: iso(r.updated_at) ?? "",
  }));
}
