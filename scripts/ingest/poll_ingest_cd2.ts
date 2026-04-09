import "../_dotenv-path";
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import postgres from "postgres";

import { requireDatabaseUrl } from "@/lib/env";

const ROOT = process.cwd();

const DEFAULT_CROSSTABS = path.join(
  ROOT,
  "data/polls/ar_cd2/2025/full_crosstabs_2025-04-24_to_2025-04-28.pdf",
);
const DEFAULT_MEMO = path.join(
  ROOT,
  "data/polls/ar_cd2/2025/benchmark_memo_2025-04-29.pdf",
);

const SURVEY_NAME = "AR CD2 Benchmark April 2025";
const SURVEY_GEO = "AR CD2";
const POLL_START = "2025-04-24";
const POLL_END = "2025-04-28";

type ParsedRow = {
  pdfPage: number;
  tableIndex: number;
  questionNumber: number;
  questionText: string;
  headerRow1: string;
  headerRow2: string;
  segmentGroupRaw: string;
  segmentLabelRaw: string;
  segmentType: string | null;
  segmentValue: string;
  responseLabel: string;
  pct: number | null;
  sampleN: number | null;
};

/** Split PDF header cells; preserve empty middle cells only when needed (this PDF rarely uses them). */
function tabCells(line: string): string[] {
  return line.split("\t").map((c) => c.trim());
}

function parseNumericCell(s: string): number | null {
  const t = s.trim();
  if (t === "" || t === "ƒ" || t === "%") return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Enumerate compositions of `sum` into `parts` positive integers. */
function compositions(sum: number, parts: number): number[][] {
  if (parts < 1 || sum < parts) return [];
  if (parts === 1) return sum >= 1 ? [[sum]] : [];
  const out: number[][] = [];
  for (let first = 1; first <= sum - parts + 1; first++) {
    for (const rest of compositions(sum - first, parts - 1)) {
      out.push([first, ...rest]);
    }
  }
  return out;
}

const SEMANTIC: { type: string; members: Set<string> }[] = [
  { type: "party", members: new Set(["Democratic", "Republican", "Independent"]) },
  { type: "race", members: new Set(["White", "Hispanic", "Black", "Asian", "Other"]) },
  { type: "race_binary", members: new Set(["Not white"]) },
  { type: "ideology", members: new Set(["Lib", "Mod", "Cons"]) },
  { type: "gender", members: new Set(["Male", "Female", "Other/RF"]) },
  { type: "likely_2026", members: new Set(["Likely", "Not Likely"]) },
  { type: "registered", members: new Set(["Yes", "No"]) },
  { type: "age_group_c", members: new Set(["18-29", "30-44", "45-64", "65+"]) },
  { type: "age_group_b", members: new Set(["18-24", "25-34", "35-54", "55-69", "70+"]) },
];

function scoreLabelGroup(labels: string[]): number {
  if (labels.length === 0) return 0;
  let best = 0;
  for (const { type, members } of SEMANTIC) {
    const hit = labels.filter((l) => members.has(l)).length;
    if (hit === labels.length && hit > 0) {
      best = Math.max(best, 100 + hit);
    } else if (hit > 0) {
      best = Math.max(best, hit);
    }
  }
  const allNumericAge = labels.every((l) => /^\d+-\d+$|^\d+\+$/.test(l));
  if (allNumericAge && labels.length >= 2) best = Math.max(best, 80);
  return best;
}

function inferWidths(groupsRaw: string[], labelsRaw: string[]): number[] {
  const groups = groupsRaw.map((g) => g.trim()).filter(Boolean);
  const labels = labelsRaw.map((l) => l.trim()).filter(Boolean);
  const G = groups.length;
  const L = labels.length;
  if (G === 0 || L === 0) return [];
  if (G === 1) return [L];
  if (G === L) return Array(G).fill(1);

  const comps = compositions(L, G);
  const firstIsTotal = /total/i.test(groups[0] ?? "");
  const filtered = firstIsTotal
    ? comps.filter((w) => w[0] === 1 && w[0]! >= 1)
    : comps;

  let best: number[] | null = null;
  let bestScore = -1;
  for (const w of filtered.length > 0 ? filtered : comps) {
    let cursor = 0;
    let score = 0;
    for (let gi = 0; gi < G; gi++) {
      const slice = labels.slice(cursor, cursor + w[gi]!);
      cursor += w[gi]!;
      score += scoreLabelGroup(slice);
    }
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best ?? [...Array(G).fill(1)];
}

function expandGroups(groups: string[], widths: number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const w = widths[i] ?? 1;
    for (let j = 0; j < w; j++) {
      out.push(groups[i]!);
    }
  }
  return out;
}

const SEGMENT_LABEL_MAP: Record<string, string> = {
  Black: "black",
  White: "white",
  Hispanic: "hispanic",
  Asian: "asian",
  Other: "other",
  "Lge city": "large_city",
  "Large city": "large_city",
  Rural: "rural",
  "Sm city": "small_city",
  Suburbs: "suburbs",
  Moderate: "moderate",
  Mod: "moderate",
  Lib: "liberal",
  Cons: "conservative",
};

function normalizeSegmentValue(segmentGroupRaw: string, labelRaw: string): string {
  if (/^total$/i.test(segmentGroupRaw.trim()) && /^n$/i.test(labelRaw.trim())) return "total";
  const direct = SEGMENT_LABEL_MAP[labelRaw];
  if (direct) return direct;
  const g = segmentGroupRaw.toLowerCase();
  const slug = labelRaw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (g.includes("race") && /white|black|hispanic|asian|other/i.test(labelRaw)) {
    return labelRaw.toLowerCase().replace(/\s+/g, "_");
  }
  if (g.includes("location") || g.includes("lge city")) {
    if (/rural/i.test(labelRaw)) return "rural";
    if (/lge|large/i.test(labelRaw)) return "large_city";
  }
  if (g.includes("ideology") && /^mod$/i.test(labelRaw)) return "moderate";
  return slug || "unknown";
}

function inferSegmentType(
  segmentGroupRaw: string,
  labelRaw: string,
): string | null {
  const g = segmentGroupRaw.toLowerCase();
  if (/^total$/i.test(segmentGroupRaw.trim()) && /^n$/i.test(labelRaw)) return "overall";
  if (/race/i.test(g)) return "race";
  if (/location|lge city|suburbs|sm city|rural/i.test(g)) return "location";
  if (/ideology/i.test(g)) return "ideology";
  if (/age/i.test(g)) return "age";
  if (/gender/i.test(g)) return "gender";
  if (/party|^\d+\. party/i.test(g)) return "party";
  if (/likely|vote in 2026/i.test(g)) return "turnout";
  if (/registered/i.test(g)) return "registration";
  if (/education/i.test(g)) return "education";
  if (/income/i.test(g)) return "income";
  if (/religion/i.test(g)) return "religion";
  if (/marital/i.test(g)) return "marital";
  if (/veteran/i.test(g)) return "veteran";
  if (/union/i.test(g)) return "union";
  if (/news/i.test(g)) return "news_media";
  if (/born again/i.test(g)) return "born_again";
  if (/child/i.test(g)) return "children_in_home";
  if (/degree/i.test(g)) return "degree";
  return null;
}

function isQuestionLine(line: string): RegExpMatchArray | null {
  return line.match(/^(\d+)\.\s+(.+)$/);
}

function isTableHeaderStart(line: string, nextLine: string | undefined): boolean {
  if (!line.startsWith("Total") || !line.includes("\t")) return false;
  if (!nextLine) return false;
  return nextLine.startsWith("n") && nextLine.includes("\t");
}

function isHeaderRow3(line: string): boolean {
  return line.includes("ƒ") && line.includes("%") && line.includes("\t");
}

function isDataRow(line: string): boolean {
  return /^\d/.test(line) && line.includes("\t");
}

/** PDF lists all response labels first, then one tabular row per response (same order). */
function lineStartsNewResponse(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  if (/^(Yes|No|Not sure|Total)$/i.test(t)) return true;
  if (/^(Definitely|Very likely|Somewhat likely|Not likely)$/i.test(t)) return true;
  if (/^(Much more likely|Somewhat more likely|Somewhat less likely|Much less likely)$/i.test(t))
    return true;
  if (/^(Strongly approve|Somewhat approve|Somewhat disapprove|Strongly disapprove)$/i.test(t))
    return true;
  if (/^(Republican|Democrat)\s/i.test(t)) return true;
  if (/^A candidate\b/i.test(t)) return true;
  if (/^Nothing really$/i.test(t)) return true;
  if (/^If the election\b/i.test(t)) return true;
  if (/^Who would you say\b/i.test(t)) return true;
  if (/^Overall opinion\b/i.test(t)) return true;
  if (/^Some other\b/i.test(t)) return true;
  if (/^Refused$/i.test(t)) return true;
  if (/^He voted\b|^He has\b|^He supports\b|^Hill has\b|^The ballot\b|^In every\b/i.test(t))
    return true;
  if (/^All Voters\b/i.test(t)) return true;
  return false;
}

function splitLabelLinesToResponses(labelLines: string[], dataRowCount: number): string[] {
  const nonEmpty = labelLines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (nonEmpty.length === 0) {
    return Array.from({ length: dataRowCount }, () => "");
  }
  if (nonEmpty.length === dataRowCount) {
    return nonEmpty;
  }

  const merged: string[] = [];
  let buf: string[] = [];
  for (const line of nonEmpty) {
    if (lineStartsNewResponse(line) && buf.length > 0) {
      merged.push(buf.join(" ").replace(/\s+/g, " ").trim());
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) merged.push(buf.join(" ").replace(/\s+/g, " ").trim());

  if (merged.length === dataRowCount) return merged;
  if (merged.length < dataRowCount) {
    while (merged.length < dataRowCount) merged.push("(unknown)");
    return merged.slice(0, dataRowCount);
  }

  /* Too many segments: bucket consecutive items */
  const out: string[] = [];
  const per = merged.length / dataRowCount;
  for (let i = 0; i < dataRowCount; i++) {
    const from = Math.round(i * per);
    const to = Math.round((i + 1) * per);
    out.push(merged.slice(from, to).join(" ").replace(/\s+/g, " ").trim());
  }
  return out;
}

function extractSurveyMeta(pageText: string): { sampleSize: number | null; moe: number | null } {
  const n = pageText.match(/N\s*=\s*(\d+)/i);
  const moe = pageText.match(/Margin of error\s*\+\/-\s*([\d.]+)/i);
  return {
    sampleSize: n ? Number(n[1]) : null,
    moe: moe ? Number(moe[1]) : null,
  };
}

function parseTablesFromPage(
  pageText: string,
  pageNum: number,
): { questionNumber: number; questionText: string; rows: ParsedRow[] }[] {
  const lines = pageText.split(/\r?\n/).map((l) => l.trim());
  const out: { questionNumber: number; questionText: string; rows: ParsedRow[] }[] = [];

  let currentQ: { number: number; text: string } | null = null;
  let tableIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const qm = isQuestionLine(lines[i]!);
    if (qm) {
      currentQ = { number: Number(qm[1]), text: qm[2]!.trim() };
      tableIndex = 0;
      continue;
    }

    if (!currentQ) continue;
    if (!isTableHeaderStart(lines[i]!, lines[i + 1])) continue;

    const q = currentQ;
    const row1 = lines[i]!;
    const row2 = lines[i + 1]!;
    const row3 = lines[i + 2];
    if (!row3 || !isHeaderRow3(row3)) {
      i += 2;
      continue;
    }

    const groups = tabCells(row1);
    const labelsFull = tabCells(row2);
    if (labelsFull.length === 0) {
      i += 2;
      continue;
    }

    const localRows: ParsedRow[] = [];
    let j = i + 3;

    const flushResponse = (label: string, dataLine: string) => {
      const cells = tabCells(dataLine);
      const pairCount = Math.floor(cells.length / 2);
      if (pairCount < 1) return;

      const labels = labelsFull.slice(0, pairCount);
      const widths = inferWidths(groups, labels);
      const groupPerCol = expandGroups(groups, widths);
      if (groupPerCol.length !== labels.length) {
        console.warn(
          `Page ${pageNum}: width mismatch groups=${groups.length} labels=${labels.length} widths=${widths.join(",")}`,
        );
        return;
      }

      for (let col = 0; col < labels.length; col++) {
        const nIdx = col * 2;
        const pIdx = col * 2 + 1;
        const sampleN = parseNumericCell(cells[nIdx] ?? "");
        const pct = parseNumericCell(cells[pIdx] ?? "");
        const segG = groupPerCol[col] ?? "";
        const segL = labels[col] ?? "";
        localRows.push({
          pdfPage: pageNum,
          tableIndex,
          questionNumber: q.number,
          questionText: q.text,
          headerRow1: row1,
          headerRow2: row2,
          segmentGroupRaw: segG,
          segmentLabelRaw: segL,
          segmentType: inferSegmentType(segG, segL),
          segmentValue: normalizeSegmentValue(segG, segL),
          responseLabel: label.trim(),
          pct,
          sampleN,
        });
      }
    };

    const labelLines: string[] = [];
    while (j < lines.length) {
      const line = lines[j]!;
      if (isQuestionLine(line)) break;
      if (isTableHeaderStart(line, lines[j + 1])) break;
      if (isDataRow(line)) break;
      labelLines.push(line);
      j++;
    }

    const dataRows: string[] = [];
    while (j < lines.length) {
      const line = lines[j]!;
      if (isQuestionLine(line)) break;
      if (isTableHeaderStart(line, lines[j + 1])) break;
      if (!isDataRow(line)) break;
      dataRows.push(line);
      j++;
    }

    const responses = splitLabelLinesToResponses(labelLines, dataRows.length);
    if (responses.length !== dataRows.length) {
      console.warn(
        `Page ${pageNum}: response label count ${responses.length} != data rows ${dataRows.length}`,
      );
    }
    for (let r = 0; r < dataRows.length; r++) {
      flushResponse(responses[r] ?? "(unknown)", dataRows[r]!);
    }

    tableIndex++;
    out.push({ questionNumber: q.number, questionText: q.text, rows: localRows });
    i = j - 1;
  }

  return out;
}

function mergeQuestionBlocks(
  blocks: { questionNumber: number; questionText: string; rows: ParsedRow[] }[],
): Map<number, { questionText: string; rows: ParsedRow[] }> {
  const map = new Map<number, { questionText: string; rows: ParsedRow[] }>();
  for (const b of blocks) {
    const prev = map.get(b.questionNumber);
    if (!prev) {
      map.set(b.questionNumber, { questionText: b.questionText, rows: [...b.rows] });
    } else {
      if (prev.questionText !== b.questionText) {
        console.warn(
          `Question ${b.questionNumber}: text differs across pages; keeping first occurrence.`,
        );
      }
      prev.rows.push(...b.rows);
    }
  }
  return map;
}

async function main(): Promise<void> {
  const crosstabsPath = process.env.POLL_CROSSTABS_PDF?.trim() || DEFAULT_CROSSTABS;
  const memoPath = process.env.POLL_MEMO_PDF?.trim() || DEFAULT_MEMO;

  if (!fs.existsSync(crosstabsPath)) {
    throw new Error(`Crosstabs PDF not found: ${crosstabsPath}`);
  }

  const buf = fs.readFileSync(crosstabsPath);
  const parser = new PDFParse({ data: buf });
  const textResult = await parser.getText();
  await parser.destroy();

  const meta = extractSurveyMeta(textResult.pages[0]?.text ?? textResult.text);

  const allBlocks: { questionNumber: number; questionText: string; rows: ParsedRow[] }[] = [];
  for (const page of textResult.pages) {
    allBlocks.push(...parseTablesFromPage(page.text, page.num));
  }

  const merged = mergeQuestionBlocks(allBlocks);
  const flatRows: ParsedRow[] = [];
  for (const [, v] of merged) {
    flatRows.push(...v.rows);
  }

  const segmentTypes = new Set<string>();
  for (const r of flatRows) {
    if (r.segmentType) segmentTypes.add(r.segmentType);
  }

  const sql = postgres(requireDatabaseUrl(), {
    ssl: "require",
    max: 1,
  });

  let inserted = 0;
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("delete from public.poll_surveys where name = $1", [
        SURVEY_NAME,
      ]);

      const surveyRows = await tx.unsafe<{ id: bigint }[]>(
        `
          insert into public.poll_surveys (
            name, poll_start_date, poll_end_date, geography, sample_size, margin_of_error_pct,
            pollster, source_files
          ) values (
            $1,
            $2::date,
            $3::date,
            $4,
            $5,
            $6,
            $7,
            $8::jsonb
          )
          returning id
        `,
        [
          SURVEY_NAME,
          POLL_START,
          POLL_END,
          SURVEY_GEO,
          meta.sampleSize,
          meta.moe,
          "John Zogby Strategies",
          JSON.stringify({
            crosstabs_pdf: path.relative(ROOT, crosstabsPath).replace(/\\/g, "/"),
            benchmark_memo_pdf: fs.existsSync(memoPath)
              ? path.relative(ROOT, memoPath).replace(/\\/g, "/")
              : null,
          }),
        ],
      );
      const survey = surveyRows[0];

      const surveyId = String(survey!.id);

      const qnums = [...merged.keys()].sort((a, b) => a - b);
      const qIdByNum = new Map<number, string>();

      for (const qn of qnums) {
        const entry = merged.get(qn)!;
        const qRows = await tx.unsafe<{ id: bigint }[]>(
          `
            insert into public.poll_questions (survey_id, question_number, question_text)
            values ($1::bigint, $2::int, $3::text)
            returning id
          `,
          [surveyId, qn, entry.questionText],
        );
        const qrow = qRows[0];
        qIdByNum.set(qn, String(qrow!.id));
      }

      const batch: Record<string, unknown>[] = [];
      const flushBatch = async () => {
        if (batch.length === 0) return;
        await tx.unsafe(
          `
            insert into public.poll_crosstabs (
              question_id,
              pdf_page,
              table_index,
              segment_group_raw,
              segment_label_raw,
              segment_type,
              segment_value,
              response_label,
              pct,
              sample_n,
              header_row1,
              header_row2
            )
            select
              (x.question_id)::bigint,
              x.pdf_page::int,
              x.table_index::int,
              x.segment_group_raw::text,
              x.segment_label_raw::text,
              x.segment_type::text,
              x.segment_value::text,
              x.response_label::text,
              x.pct::numeric,
              x.sample_n::int,
              x.header_row1::text,
              x.header_row2::text
            from jsonb_to_recordset($1::jsonb) as x(
              question_id text,
              pdf_page int,
              table_index int,
              segment_group_raw text,
              segment_label_raw text,
              segment_type text,
              segment_value text,
              response_label text,
              pct numeric,
              sample_n int,
              header_row1 text,
              header_row2 text
            )
          `,
          [JSON.stringify(batch)],
        );
        inserted += batch.length;
        batch.length = 0;
      };

      for (const r of flatRows) {
        batch.push({
          question_id: qIdByNum.get(r.questionNumber)!,
          pdf_page: r.pdfPage,
          table_index: r.tableIndex,
          segment_group_raw: r.segmentGroupRaw,
          segment_label_raw: r.segmentLabelRaw,
          segment_type: r.segmentType,
          segment_value: r.segmentValue,
          response_label: r.responseLabel,
          pct: r.pct,
          sample_n: r.sampleN,
          header_row1: r.headerRow1,
          header_row2: r.headerRow2,
        });
        if (batch.length >= 500) await flushBatch();
      }
      await flushBatch();
    });

    console.log("--- poll ingest (AR CD2) ---");
    console.log(`Survey: ${SURVEY_NAME}`);
    console.log(`Total questions: ${merged.size}`);
    console.log(`Total crosstab rows inserted: ${inserted}`);
    console.log(`Segment types detected (${segmentTypes.size}): ${[...segmentTypes].sort().join(", ")}`);
    console.log("Sample rows (first 5):");
    for (const s of flatRows.slice(0, 5)) {
      console.log(
        JSON.stringify(
          {
            q: s.questionNumber,
            response: s.responseLabel.slice(0, 80),
            segment: `${s.segmentGroupRaw} / ${s.segmentLabelRaw}`,
            segment_value: s.segmentValue,
            n: s.sampleN,
            pct: s.pct,
            page: s.pdfPage,
          },
          null,
          0,
        ),
      );
    }
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
