import { notFound } from "next/navigation";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import { SectionCard } from "@/components/dashboard/section-card";
import { TableShell } from "@/components/site/table-shell";
import { StatusPill } from "@/components/dashboard/status-pill";
import { ExpandableSection } from "@/components/site/expandable-section";
import { MetricCard } from "@/components/site/metric-card";
import { CreateWorkflowTaskButton } from "@/components/cm-hub/create-workflow-task-button";
import sql from "@/lib/db";
import { getPersonById } from "@/lib/queries/people";
import { getPersonCompliance } from "@/lib/queries/compliance";

export const dynamic = "force-dynamic";

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Person360Page({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const person = await getPersonById(personId);
  if (!person) notFound();

  const [contacts, identifiers, sources, activity, compliance] = await Promise.all([
    sql<
      Array<{
        id: string;
        contact_type: string;
        contact_value: string;
        is_primary: boolean;
        is_verified: boolean;
        consent_status: string;
        updated_at: string | Date;
      }>
    >`
      select id::text, contact_type, contact_value, is_primary, is_verified, consent_status, updated_at
      from public.person_contact_methods
      where person_id = ${personId}::uuid
      order by is_primary desc, is_verified desc, updated_at desc
      limit 50
    `,
    sql<
      Array<{
        id: string;
        identifier_type: string;
        identifier_value: string;
        source_system: string;
        is_primary: boolean;
        is_verified: boolean;
        created_at: string | Date;
      }>
    >`
      select id::text, identifier_type, identifier_value, source_system, is_primary, is_verified, created_at
      from public.person_identifiers
      where person_id = ${personId}::uuid
      order by is_primary desc, is_verified desc, created_at desc
      limit 50
    `,
    sql<
      Array<{
        id: string;
        source_system: string;
        source_table: string;
        source_record_key: string;
        match_type: string;
        match_score: string | number | null;
        linked_by: string;
        linked_at: string | Date;
      }>
    >`
      select id::text, source_system, source_table, source_record_key, match_type, match_score, linked_by, linked_at
      from public.person_source_links
      where person_id = ${personId}::uuid
      order by linked_at desc
      limit 100
    `,
    sql<
      Array<{
        id: string;
        activity_type: string;
        activity_source: string | null;
        activity_ref_id: string | null;
        occurred_at: string | Date;
        metadata: any;
      }>
    >`
      select id::text, activity_type, activity_source, activity_ref_id, occurred_at, metadata
      from public.person_activity
      where person_id = ${personId}::uuid
      order by occurred_at desc
      limit 100
    `,
    getPersonCompliance(personId),
  ]);

  const displayName =
    person.displayName ??
    ([person.firstName, person.lastName].filter(Boolean).join(" ") || "Person");

  const primaryEmail =
    contacts.find((c) => c.contact_type === "email" && c.is_primary)?.contact_value ??
    contacts.find((c) => c.contact_type === "email")?.contact_value ??
    null;

  const primaryPhone =
    contacts.find((c) => c.contact_type.includes("phone") && c.is_primary)?.contact_value ??
    contacts.find((c) => c.contact_type.includes("phone"))?.contact_value ??
    null;

  const blockedChannels = compliance.filter((c) => c.isSuppressed || c.consentStatus === "denied");
  const bannerTone =
    blockedChannels.length === 0
      ? ("success" as const)
      : blockedChannels.length >= 2
        ? ("danger" as const)
        : ("warning" as const);

  return (
    <PageShell>
      <PageHero
        eyebrow="People • 360 profile"
        title={displayName}
        description="Unified person record with linked sources (voter/volunteer/field/donor) and auditable provenance."
        pills={
          <>
            <StatusPill tone="neutral">{person.status}</StatusPill>
            <StatusPill tone={person.isVolunteer ? "success" : "neutral"}>
              {person.isVolunteer ? "Volunteer" : "Not volunteer"}
            </StatusPill>
            <StatusPill tone={person.isDonor ? "success" : "neutral"}>
              {person.isDonor ? "Donor" : "Not donor"}
            </StatusPill>
            <StatusPill tone="neutral">Supporter</StatusPill>
          </>
        }
        actions={
          <CreateWorkflowTaskButton
            label="Create workflow task"
            defaultTitle={`[Person] ${displayName} — next action`}
            personId={personId}
            defaultDepartment="campaign"
            defaultPriority="high"
          />
        }
      />

      <SectionCard
        title="Compliance (outreach eligibility)"
        description="Platform-enforced channel status based on latest consent + active suppressions."
      >
        <div
          className={`rounded-3xl border p-5 ${
            bannerTone === "success"
              ? "border-emerald-400/20 bg-emerald-500/10"
              : bannerTone === "warning"
                ? "border-amber-400/20 bg-amber-500/10"
                : "border-rose-400/20 bg-rose-500/10"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {blockedChannels.length === 0
                  ? "Outreach allowed (no active blocks detected)"
                  : "Outreach partially blocked — review channels"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-200/80">
                Use this before assigning texting/email tasks. When integrations land, message sends will write to the
                message log and opt-outs will auto-create suppressions.
              </p>
            </div>
            <a
              href={`/api/compliance/person/${personId}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
            >
              View JSON
            </a>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {compliance.map((c) => (
              <span
                key={c.channel}
                className={`rounded-full border px-3 py-1 font-semibold ${
                  c.isSuppressed || c.consentStatus === "denied"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    : c.consentStatus === "granted"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-slate-200"
                }`}
              >
                {c.channel}: {c.isSuppressed ? `suppressed (${c.suppressionReason ?? "—"})` : c.consentStatus}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="At a glance" description="Fast identity + comms readiness summary.">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Primary email" value={primaryEmail ?? "—"} subvalue="From contact methods" tone="sky" />
          <MetricCard label="Primary phone" value={primaryPhone ?? "—"} subvalue="From contact methods" tone="sky" />
          <MetricCard
            label="Last updated"
            value={fmtWhen(person.updatedAt)}
            subvalue={`Created ${fmtWhen(person.createdAt)}`}
            tone="neutral"
          />
        </div>
      </SectionCard>

      <SectionCard title="Contact methods" description="Channel permissions and consent live here.">
        <TableShell>
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Value</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Consent</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Primary</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    No contact methods yet.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="bg-slate-900/40 hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                      {c.contact_type}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{c.contact_value}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {c.consent_status}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {c.is_primary ? "yes" : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {c.is_verified ? "yes" : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>

      <ExpandableSection
        title="Identifiers"
        description="Stable keys used for identity resolution (email, phone, voter_id, volunteer_id, etc.)."
        defaultOpen={false}
      >
        <TableShell>
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Source</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Primary</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {identifiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    No identifiers yet.
                  </td>
                </tr>
              ) : (
                identifiers.map((i) => (
                  <tr key={i.id} className="bg-slate-900/40 hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                      {i.identifier_type}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{i.identifier_value}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">{i.source_system}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {i.is_primary ? "yes" : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {i.is_verified ? "yes" : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </ExpandableSection>

      <ExpandableSection
        title="Source links (provenance)"
        description="What original records this person is linked to (no source rows are destroyed)."
      >
        <TableShell>
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Source</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Table</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Record</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Match</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Linked at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    No source links yet.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.id} className="bg-slate-900/40 hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                      {s.source_system}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">{s.source_table}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {s.source_record_key}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {s.match_type}
                      {s.match_score != null ? ` (${Number(s.match_score).toFixed(0)})` : ""}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtWhen(String(s.linked_at))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </ExpandableSection>

      <ExpandableSection title="Activity timeline" description="Every meaningful action should attach here.">
        <TableShell>
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">When</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-slate-400">
                    No activity yet.
                  </td>
                </tr>
              ) : (
                activity.map((a) => (
                  <tr key={a.id} className="bg-slate-900/40 hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {fmtWhen(String(a.occurred_at))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-white">
                      {a.activity_type}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {a.activity_source ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {a.activity_ref_id ? <span className="text-slate-200">{a.activity_ref_id}</span> : null}
                      {a.metadata ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/30 p-3 text-xs text-slate-300">
                          {JSON.stringify(a.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </ExpandableSection>
    </PageShell>
  );
}

