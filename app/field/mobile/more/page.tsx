import Link from "next/link";
import { MobileTopBar } from "@/components/field/mobile-topbar";

export const dynamic = "force-dynamic";

export default function FieldMorePage() {
  return (
    <>
      <MobileTopBar title="More" left={<span className="text-xs text-slate-400">Settings</span>} right={<span className="text-xs text-slate-400">—</span>} />
      <div className="space-y-3 px-4 py-5">
        {[
          { label: "Profile", href: "/volunteers/dashboard" },
          { label: "Sync", href: "/field/mobile/sync" },
          { label: "Help", href: "/field/mobile/help" },
          { label: "Back to dashboard", href: "/dashboard" },
        ].map((i) => (
          <Link
            key={i.label}
            href={i.href}
            className="block rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-sm font-semibold text-white hover:bg-slate-900/70"
          >
            {i.label}
          </Link>
        ))}
      </div>
    </>
  );
}

