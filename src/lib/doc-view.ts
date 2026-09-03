import { headingLevel, isSectionHeading } from "./headings";
import type { Finding, ReviewRole, Severity as FindingSeverity } from "./types";

export type MarkLevel = 3 | 2 | 1;
export type CommentStatus = "accepted" | "rejected" | null;

export type Block =
  | { type: "h1" | "h2" | "h3" | "p"; text: string }
  | { type: "li"; text: string; ordered?: boolean; n?: number }
  | { type: "table"; head: string[]; rows: string[][] };

export type Anchor = {
  block: number;
  row?: number;
  col?: number;
  match: string;
};

export type DocComment = {
  id: string;
  n: number;
  severity: MarkLevel;
  findingSeverity: FindingSeverity;
  place: string;
  quote: string;
  why: string;
  ask: string;
  ruleId?: string;
  role: ReviewRole;
  anchors: Anchor[];
};

export function levelFromFinding(s: FindingSeverity): MarkLevel {
  if (s === "high") return 3;
  if (s === "medium") return 2;
  return 1;
}

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i += 1;
      continue;
    }
    const plainLevel = headingLevel(line);
    if (plainLevel) {
      blocks.push({
        type: plainLevel === 3 ? "h3" : "h2",
        text: line.trim().replace(/:$/, ""),
      });
      i += 1;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const raw: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        raw.push(lines[i] ?? "");
        i += 1;
      }
      const parsed = raw
        .map((row) =>
          row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim()),
        )
        .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || c === ""));
      if (parsed[0]) {
        blocks.push({ type: "table", head: parsed[0], rows: parsed.slice(1) });
      }
      continue;
    }
    const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (/^\s*[-•*]\s+/.test(line) || (ordered && !isSectionHeading(line))) {
      blocks.push({
        type: "li",
        text: line.replace(/^\s*(?:[-•*]|\d+\.)\s+/, "").trim(),
        ordered: Boolean(ordered),
        n: ordered ? Number(ordered[1]) : undefined,
      });
      i += 1;
      continue;
    }
    const parts = [line.trim()];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] ?? "";
      if (!next.trim()) break;
      if (next.startsWith("#") || headingLevel(next)) break;
      if (next.trim().startsWith("|")) break;
      if (/^\s*[-•*]\s+/.test(next) || /^\s*\d+\.\s+/.test(next)) break;
      parts.push(next.trim());
      i += 1;
    }
    blocks.push({ type: "p", text: parts.join(" ") });
  }
  return blocks;
}

function matchIn(text: string, quote: string): string | null {
  const q = quote.replace(/\s+/g, " ").trim();
  if (!q || q === "раздел отсутствует") return null;
  if (text.includes(q)) return q.length > 96 ? q.slice(0, 96) : q;
  const short = q.slice(0, 28);
  const idx = text.indexOf(short);
  if (idx >= 0) {
    return text.slice(idx, Math.min(text.length, idx + Math.min(q.length, 72)));
  }
  return null;
}

export function commentsFromFindings(
  blocks: Block[],
  findings: Finding[],
): DocComment[] {
  return findings.map((f, n) => {
    const anchors: Anchor[] = [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      if (!block) continue;
      if (block.type === "table") {
        block.head.forEach((cell, ci) => {
          const m = matchIn(cell, f.quote);
          if (m) anchors.push({ block: bi, row: -1, col: ci, match: m });
        });
        block.rows.forEach((row, ri) => {
          row.forEach((cell, ci) => {
            const m = matchIn(cell, f.quote);
            if (m) anchors.push({ block: bi, row: ri, col: ci, match: m });
          });
        });
      } else {
        const m = matchIn(block.text, f.quote);
        if (m) anchors.push({ block: bi, match: m });
      }
    }
    return {
      id: f.id,
      n: n + 1,
      severity: levelFromFinding(f.severity),
      findingSeverity: f.severity,
      place: f.section,
      quote: f.quote,
      why: f.why,
      ask: f.ask,
      ruleId: f.ruleId,
      role: f.role,
      anchors: anchors.slice(0, 3),
    };
  });
}
