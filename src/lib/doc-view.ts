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

const MISSING_QUOTE =
  /^(раздел отсутствует|раздел фильтрации отсутствует|раздел сериализации отсутствует|перечень справочников отсутствует|файловое хранение без пути|топики без кластера)/i;

const WEAK_SECTIONS = new Set(["документ", "раздел", ""]);

function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»„“”"']/g, "")
    .replace(/[…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quotePieces(quote: string): string[] {
  const raw = quote.replace(/\s+/g, " ").trim();
  if (!raw || MISSING_QUOTE.test(raw)) return [];
  const parts = raw
    .split(/\s*(?:\/|↔|—)\s*/)
    .map((p) => p.replace(/…$/u, "").trim())
    .filter((p) => p.length >= 4);
  return [raw.replace(/…$/u, "").trim(), ...parts].filter(Boolean);
}

function clipMatch(text: string, start: number, len: number): string {
  return text.slice(start, Math.min(text.length, start + Math.min(len, 96)));
}

function indexIgnoreCase(text: string, needle: string): number {
  if (!needle) return -1;
  const exact = text.indexOf(needle);
  if (exact >= 0) return exact;
  return fold(text).indexOf(fold(needle)) >= 0
    ? text.toLowerCase().replace(/ё/g, "е").indexOf(fold(needle))
    : -1;
}

function matchIn(text: string, quote: string): string | null {
  if (!text.trim()) return null;
  const cell = text.trim();
  const foldedCell = fold(cell);
  if (
    foldedCell.length >= 6 &&
    !MISSING_QUOTE.test(quote) &&
    fold(quote).includes(foldedCell)
  ) {
    return cell.length > 96 ? cell.slice(0, 96) : cell;
  }
  for (const piece of quotePieces(quote)) {
    const exact = text.indexOf(piece);
    if (exact >= 0) return clipMatch(text, exact, piece.length);
    const foldedNeedle = fold(piece);
    if (foldedNeedle.length < 4) continue;
    const lower = text.toLowerCase().replace(/ё/g, "е");
    const foldedIdx = lower.indexOf(foldedNeedle);
    if (foldedIdx >= 0) return clipMatch(text, foldedIdx, piece.length);
    const shortLen = Math.min(28, piece.length);
    if (shortLen >= 8) {
      const shortIdx = indexIgnoreCase(text, piece.slice(0, shortLen));
      if (shortIdx >= 0) return clipMatch(text, shortIdx, piece.length);
    }
  }
  return null;
}

function sectionPieces(section: string): string[] {
  return section
    .split(/\s*\/\s*/)
    .map((s) => s.replace(/^\d+\.\s+/, "").replace(/:$/, "").trim())
    .filter((s) => !WEAK_SECTIONS.has(fold(s)) && fold(s).length >= 4);
}

function headingOf(block: Block): string | null {
  if (block.type === "h1" || block.type === "h2" || block.type === "h3") {
    return block.text;
  }
  return null;
}

function sectionHitsHeading(heading: string, section: string): boolean {
  const h = fold(heading);
  return sectionPieces(section).some((piece) => {
    const p = fold(piece);
    return h === p || h.includes(p) || p.includes(h);
  });
}

function collectQuoteAnchors(blocks: Block[], quote: string): Anchor[] {
  const anchors: Anchor[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (!block) continue;
    if (block.type === "table") {
      block.head.forEach((cell, ci) => {
        const m = matchIn(cell, quote);
        if (m) anchors.push({ block: bi, row: -1, col: ci, match: m });
      });
      block.rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          const m = matchIn(cell, quote);
          if (m) anchors.push({ block: bi, row: ri, col: ci, match: m });
        });
      });
      continue;
    }
    const m = matchIn(block.text, quote);
    if (m) anchors.push({ block: bi, match: m });
  }
  return anchors;
}

function collectSectionAnchors(blocks: Block[], section: string): Anchor[] {
  const anchors: Anchor[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (!block) continue;
    const heading = headingOf(block);
    if (heading && sectionHitsHeading(heading, section)) {
      anchors.push({ block: bi, match: heading });
    }
  }
  return anchors;
}

export function commentsFromFindings(
  blocks: Block[],
  findings: Finding[],
): DocComment[] {
  return findings.map((f, n) => {
    const fromQuote = collectQuoteAnchors(blocks, f.quote);
    const anchors = (fromQuote.length ? fromQuote : collectSectionAnchors(blocks, f.section)).slice(
      0,
      3,
    );
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
      anchors,
    };
  });
}

export function isLinkedComment(comment: DocComment): boolean {
  return comment.anchors.length > 0;
}
