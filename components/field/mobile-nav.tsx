"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/field/mobile/home", label: "Home" },
  { href: "/field/mobile/turf", label: "Turf" },
  { href: "/field/mobile/contacts", label: "Contacts" },
  { href: "/field/mobile/tasks", label: "Tasks" },
  { href: "/field/mobile/more", label: "More" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {NAV.map((n) => {
          const active = pathname?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={[
                "flex-1 px-3 py-3 text-center text-xs font-semibold tracking-wide",
                active ? "text-white" : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

