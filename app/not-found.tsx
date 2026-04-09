import Link from "next/link";
import { PageShell } from "@/components/site/page-shell";
import { PageHero } from "@/components/site/page-hero";

export default function NotFound() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Not found"
        title="That page doesn’t exist."
        description="If you followed a stale link, head back to the county intelligence hub or the dashboard."
        actions={
          <>
            <Link
              href="/counties"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Counties
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Home
            </Link>
          </>
        }
      />
    </PageShell>
  );
}

