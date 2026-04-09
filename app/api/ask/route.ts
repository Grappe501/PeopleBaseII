import { ASK_REPORT_CATALOG, runAskReport } from "@/lib/ask/reports";
import { getOpenAiApiKey } from "@/lib/env";
import type { AskReportId } from "@/lib/types/intelligence";
import { ASK_REPORT_IDS } from "@/lib/types/intelligence";

type AskRequest = {
  prompt?: string;
};

function isAskReportId(v: unknown): v is AskReportId {
  return typeof v === "string" && (ASK_REPORT_IDS as string[]).includes(v);
}

async function routePromptToReport(prompt: string): Promise<{
  report: AskReportId;
  limit: number;
}> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { report: "cd2_intel_summary", limit: 120 };
  }

  const catalog = ASK_REPORT_CATALOG.map(
    (r) => `- ${r.id}: ${r.description}`,
  ).join("\n");

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
            "If unclear, use cd2_intel_summary.",
        },
        {
          role: "user",
          content: `Allowed reports:\n${catalog}\n\nUser question:\n${prompt.slice(0, 4000)}`,
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
    return { report: "cd2_intel_summary", limit: 120 };
  }

  const report = isAskReportId(parsed.report) ? parsed.report : "cd2_intel_summary";
  const lim = Number(parsed.limit);
  const limit = Number.isFinite(lim)
    ? Math.min(250, Math.max(20, Math.floor(lim)))
    : 120;

  return { report, limit };
}

async function summarizeReport(
  prompt: string,
  reportJson: string,
): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return (
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
            "You are a political data analyst. Answer using ONLY the JSON data provided. " +
            "Cite numbers. If data is missing, say so. Do not invent counties or precincts. " +
            "Use short sections with bullets.",
        },
        {
          role: "user",
          content: `Question:\n${prompt.slice(0, 2000)}\n\nData (JSON):\n${reportJson.slice(0, 14000)}`,
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

    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required." },
        { status: 400 },
      );
    }

    const routed = await routePromptToReport(prompt);
    const ran = await runAskReport(routed.report, { limit: routed.limit });

    if (!ran) {
      return Response.json({
        success: false,
        error: "Unknown report.",
      });
    }

    const reportJson = JSON.stringify(ran.payload);
    let answer: string;
    try {
      answer = await summarizeReport(prompt, reportJson);
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
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
