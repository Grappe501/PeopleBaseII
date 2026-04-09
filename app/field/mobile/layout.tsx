import type { ReactNode } from "react";
import { MobileBottomNav } from "@/components/field/mobile-nav";

export const dynamic = "force-dynamic";

export default function FieldMobileLayout({ children }: { children: ReactNode }) {
  return (
    <main className="kg-grain min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md pb-20">{children}</div>
      <MobileBottomNav />
    </main>
  );
}

