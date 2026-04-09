"use client";

import { useMemo } from "react";
import { useParams, usePathname } from "next/navigation";
import { ReportsAgentPanel } from "@/components/reports/reports-agent-panel";
import type { AskClientContextPack } from "@/lib/types/contracts/agent-context";

function useAskContextPack(pathname: string): AskClientContextPack {
  const params = useParams();

  return useMemo(() => {
    const p = params as Record<string, string | string[] | undefined>;
    const get = (k: string): string | undefined => {
      const v = p[k];
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v[0];
      return undefined;
    };
    const path = pathname || "/";

    if (path.startsWith("/people/")) {
      return { surface: "person", pathname: path, personId: get("personId") };
    }
    if (path.startsWith("/counties/")) {
      return {
        surface: "county",
        pathname: path,
        countyKey: get("countyKey"),
        cityKey: get("cityKey"),
      };
    }
    if (path.startsWith("/cm-hub/workflows")) {
      return { surface: "workflows", pathname: path };
    }
    if (path.startsWith("/cm-hub")) {
      return { surface: "cm_hub", pathname: path };
    }
    if (path.startsWith("/dashboard")) {
      return { surface: "dashboard", pathname: path };
    }
    if (path.startsWith("/command-center")) {
      return { surface: "command_center", pathname: path };
    }
    return { surface: "global", pathname: path };
  }, [pathname, params]);
}

export function GlobalAgent() {
  const pathname = usePathname() ?? "/";
  const contextPack = useAskContextPack(pathname);

  const hidden = useMemo(() => {
    if (pathname.startsWith("/field/mobile")) return true;
    return false;
  }, [pathname]);

  const label = useMemo(() => {
    if (pathname.startsWith("/cm-hub")) return "Reports Agent — CM Hub";
    if (pathname.startsWith("/counties")) return "Reports Agent — County Intelligence";
    if (pathname.startsWith("/dashboard")) return "Reports Agent — Dashboard";
    if (pathname.startsWith("/people")) return "Reports Agent — People 360";
    if (pathname.startsWith("/command-center")) return "Reports Agent — Command Center";
    return "Reports Agent";
  }, [pathname]);

  const defaultPrompt = useMemo(() => {
    if (pathname.startsWith("/counties/")) {
      return "Summarize the top risks/opportunities for this county and suggest 3 next actions.";
    }
    if (pathname.startsWith("/cm-hub/workflows")) {
      return "What are the top 5 bottlenecks this week and which tasks are blocked?";
    }
    if (pathname.startsWith("/people/")) {
      return "Summarize this person’s engagement history and suggest the next best outreach step.";
    }
    return "";
  }, [pathname]);

  return (
    <ReportsAgentPanel
      contextLabel={label}
      defaultPrompt={defaultPrompt}
      hidden={hidden}
      contextPack={contextPack}
    />
  );
}
