import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";
import { StatusPill } from "@/components/dashboard/status-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { getVolunteerDetailPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

export default async function VolunteerDetailPage({
  params,
}: {
  params: Promise<{ volunteerId: string }>;
}) {
  const { volunteerId } = await params;
  const id = Number(volunteerId);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const payload = await getVolunteerDetailPayload(id);
  if (!payload.volunteer) notFound();
  const v = payload.volunteer;

  const displayName =
    v.firstName || v.lastName
      ? `${v.firstName ?? ""} ${v.lastName ?? ""}`.trim()
      : `Volunteer #${v.id}`;

  return (
    <PageShell>
      <PageHero
        eyebrow="Volunteer OS"
        title={displayName}
        description="Profile + operational context. Next steps and activity history will live here as tasks and comms are wired in."
        pills={
          <>
            <StatusPill tone="neutral">{v.volunteerStatus}</StatusPill>
            <StatusPill tone="neutral">Onboarding: {v.onboardingStatus}</StatusPill>
            <StatusPill tone="neutral">{v.countyName ?? "No county assigned"}</StatusPill>
          </>
        }
        actions={
          <>
            <Link
              href="/volunteers/list"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Back to list
            </Link>
            <Link
              href="/volunteers/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Volunteer dashboard
            </Link>
          </>
        }
      />

      <SectionCard title="Contact" description="Basic identity + how to reach them.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Email</p>
            <p className="mt-2 text-sm font-semibold text-white">{v.email ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Phone</p>
            <p className="mt-2 text-sm font-semibold text-white">{v.phone ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">County</p>
            <p className="mt-2 text-sm font-semibold text-white">{v.countyName ?? "—"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Next best action (coming next)"
        description="This panel will be driven by task assignments + completion signals."
      >
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
          Next: wire in tasks and a “follow-up queue” so every volunteer gets a clear next step.
        </div>
      </SectionCard>
    </PageShell>
  );
}

