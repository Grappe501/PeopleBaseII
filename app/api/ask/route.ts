import { ASK_REPORT_CATALOG, runAskReport } from "@/lib/ask/reports";
import { enrichAskContext, routerBiasFromSurface } from "@/lib/ask/context-pack";
import { parseClientContext } from "@/lib/ask/parse-client-context";
import { getOpenAiApiKey } from "@/lib/env";
import type { AskReportId } from "@/lib/types/intelligence";
import { ASK_REPORT_IDS } from "@/lib/types/intelligence";

type AskRequest = {
  prompt?: string;
  /** Optional page context from the client (validated + server-enriched). */
  context?: unknown;
};

function isAskReportId(v: unknown): v is AskReportId {
  return typeof v === "string" && (ASK_REPORT_IDS as string[]).includes(v);
}

async function routePromptToReport(
  prompt: string,
  options: { routerBlock: string },
): Promise<{
  report: AskReportId;
  limit: number;
}> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { report: "campaign_kpi_snapshot", limit: 120 };
  }

  const catalog = ASK_REPORT_CATALOG.map(
    (r) => `- ${r.id}: ${r.description}`,
  ).join("\n");

  const userBlock = [
    options.routerBlock.trim() && `${options.routerBlock.trim()}\n`,
    `User question:\n${prompt.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You choose which analytics report to run. Reply with JSON only: {\"report\": string, \"limit\": number}. " +
            "report must be one of the allowed ids. limit between 20 and 250. " +
            "If unclear, prefer campaign_kpi_snapshot for overall campaign health (KPIs, top counties). " +
            "Use cd2_intel_summary or other cd2_* ids for district/precinct/segment analytics. " +
            "Use workflow_tasks_summary for tasks and bottlenecks. Use messaging_journeys_summary for journey enrollment stats. " +
            "Use person_ask_snapshot only when page context includes a person UUID (Person 360); it returns profile, compliance, tags, activity, journeys, and linked tasks for that person. " +
            "Use page context hints when they help choose the best report.",
        },
        {
          role: "user",
          content: `Allowed reports:\n${catalog}\n\n${userBlock}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI routing failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: { report?: string; limit?: number };
  try {
    parsed = JSON.parse(raw) as { report?: string; limit?: number };
  } catch {
    return { report: "campaign_kpi_snapshot", limit: 120 };
  }

  const report = isAskReportId(parsed.report) ? parsed.report : "campaign_kpi_snapshot";
  const lim = Number(parsed.limit);
  const limit = Number.isFinite(lim)
    ? Math.min(250, Math.max(20, Math.floor(lim)))
    : 120;

  return { report, limit };
}

async function summarizeReport(
  prompt: string,
  reportJson: string,
  focusBlock: string,
): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    const pre = focusBlock.trim()
      ? `Context:\n${focusBlock.slice(0, 2000)}\n\n`
      : "";
    return (
      pre +
      "OpenAI key not configured; raw report JSON follows.\n\n" +
      reportJson.slice(0, 12000)
    );
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are a campaign operations and data analyst. Answer using ONLY the JSON data provided. " +
            "Cite numbers. If data is missing, say so. Do not invent counties, precincts, or metrics. " +
            "When Page context names a county or person, prioritize that row or relevant slice if it appears in the JSON; do not fabricate fields that are not in the JSON. " +
            "Use short sections with bullets.",
        },
        {
          role: "user",
          content: [
            `Question:\n${prompt.slice(0, 2000)}`,
            focusBlock.trim() && `Page context:\n${focusBlock.slice(0, 2500)}`,
            `Data (JSON):\n${reportJson.slice(0, 14000)}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI summarize failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "No summary returned.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskRequest;
    const prompt = body.prompt?.trim() ?? "";
    const clientPack = parseClientContext(body.context);

    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required." },
        { status: 400 },
      );
    }

    const enriched = await enrichAskContext(clientPack);
    const bias = clientPack ? routerBiasFromSurface(clientPack.surface) : "";
    const routerBlock = [
      enriched.hints && `Server-enriched context:\n${enriched.hints}`,
      bias && `Routing bias:\n${bias}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const routed = await routePromptToReport(prompt, { routerBlock });
    let ran = await runAskReport(routed.report, {
      limit: routed.limit,
      personId: clientPack?.personId,
    });

    if (!ran && routed.report === "person_ask_snapshot") {
      ran = await runAskReport("campaign_kpi_snapshot", {
        limit: routed.limit,
        personId: clientPack?.personId,
      });
    }

    if (!ran) {
      return Response.json({
        success: false,
        error: "Unknown report.",
      });
    }

    const reportJson = JSON.stringify(ran.payload);
    const focusForSummary = [
      enriched.hints && `Enriched:\n${enriched.hints}`,
      enriched.summaryLine && `Summary: ${enriched.summaryLine}`,
    ]
      .filter(Boolean)
      .join("\n");

    let answer: string;
    try {
      answer = await summarizeReport(prompt, reportJson, focusForSummary);
    } catch (summErr) {
      answer =
        `Summary step failed (${String(summErr)}). Here is compact JSON for manual review.\n\n` +
        reportJson.slice(0, 14000);
    }

    return Response.json({
      success: true,
      data: {
        prompt,
        reportId: ran.id,
        reportTitle: ran.title,
        answer,
        reportPayload: ran.payload,
        contextSummaryLine: enriched.summaryLine || null,
        contextHints: enriched.hints || null,
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
