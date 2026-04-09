import type { AskClientContextPack } from "@/lib/types/contracts/agent-context";

const SURFACES = new Set<AskClientContextPack["surface"]>([
  "global",
  "cm_hub",
  "dashboard",
  "county",
  "person",
  "workflows",
  "command_center",
]);

export function parseClientContext(raw: unknown): AskClientContextPack | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const pathname = o.pathname;
  const surface = o.surface;
  if (typeof pathname !== "string" || pathname.length > 600) return undefined;
  if (typeof surface !== "string" || !SURFACES.has(surface as AskClientContextPack["surface"])) {
    return undefined;
  }

  const trim = (v: unknown, max: number): string | undefined =>
    typeof v === "string" && v.length <= max ? v.trim() || undefined : undefined;

  return {
    surface: surface as AskClientContextPack["surface"],
    pathname,
    personId: trim(o.personId, 80),
    countyKey: trim(o.countyKey, 120),
    cityKey: trim(o.cityKey, 120),
  };
}
