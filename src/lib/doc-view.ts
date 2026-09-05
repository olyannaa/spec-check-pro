import { headingLevel, isSectionHeading } from "./headings";
import type { Finding, ReviewRole, Severity as FindingSeverity } from "./types";

export type MarkLevel = 3 | 2 | 1;
export type CommentStatus = "accepted" | "rejected" | null;

export type Block =
  | { type: "h1" | "h2" | "h3" | "p"; text: string }
  | { type: "li"; text: string; ordered?: boolean; n?: number }
  | { type: "table"; head: string[]; rows: string[][] };

export type AnchorCover = "block" | "row" | "cell" | "span";

export type Anchor = {
  block: number;
  row?: number;
  col?: number;
  match: string;
  cover: AnchorCover;
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

const RULE_HINTS: Record<string, string[]> = {
  "1": ["сериализ", "приемник", "приёмник", "источник", "kafka", "топик"],
  "2": ["каталог", "источник", "ссылка", "gitlab", "jira"],
  "3": ["поле", "структура", "тип данных", "таблица"],
  "4": ["фильтр", "алгоритм", "обработ"],
  "5": ["обогащ", "ddl", "пример", "ключ", "партиц", "структура"],
  "6": ["kafka", "топик", "кластер", "приемник", "приёмник"],
  "7": ["hdfs", "путь", "хранен", "папка"],
  "8": ["справочник", "источник", "витрин"],
};

/** Find `needle` in `text` and return indices into the original string. */
export function locate(
  text: string,
  needle: string,
): { start: number; end: number } | null {
  if (!text || !needle) return null;
  const clean = needle.replace(/…$/u, "").trim();
  if (!clean) return null;
  const exact = text.indexOf(clean);
  if (exact >= 0) return { start: exact, end: exact + clean.length };
  const t = text.toLowerCase().replace(/ё/g, "е");
  const n = clean.toLowerCase().replace(/ё/g, "е");
  const idx = t.indexOf(n);
  if (idx >= 0) return { start: idx, end: Math.min(text.length, idx + clean.length) };
  if (n.length > 16) {
    const short = n.slice(0, 16);
    const sidx = t.indexOf(short);
    if (sidx >= 0) return { start: sidx, end: Math.min(text.length, sidx + 16) };
  }
  return null;
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

function matchIn(text: string, quote: string): string | null {
  if (!text.trim() || MISSING_QUOTE.test(quote)) return null;
  const cell = text.trim();
  if (cell.length >= 4 && locate(quote, cell)) {
    return cell.length > 96 ? cell.slice(0, 96) : cell;
  }
  for (const piece of quotePieces(quote)) {
    const found = locate(text, piece);
    if (found) return text.slice(found.start, Math.min(found.end, found.start + 96));
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

function isDistinctiveCell(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[A-Za-z0-9]+[_.-][A-Za-z0-9_.-]{2,}/.test(t)) return true;
  if (t.length >= 16) return true;
  return false;
}

function tableCells(block: Extract<Block, { type: "table" }>) {
  const cells: { row: number; col: number; text: string }[] = [];
  block.head.forEach((text, col) => cells.push({ row: -1, col, text }));
  block.rows.forEach((row, ri) => {
    row.forEach((text, col) => cells.push({ row: ri, col, text }));
  });
  return cells;
}

function quoteNamesCell(quote: string, cell: string): boolean {
  const t = cell.trim();
  if (!isDistinctiveCell(t)) return false;
  if (locate(quote, t)) return true;
  const id = t.match(/[A-Za-z][A-Za-z0-9]*[_.-][A-Za-z0-9_.-]+/);
  return !!(id && locate(quote, id[0]));
}

function quoteIsTableDump(quote: string): boolean {
  return /\|/.test(quote) || /поле\s+тип/i.test(quote) || /тип данных/i.test(quote);
}

function collectTableAnchors(
  block: Extract<Block, { type: "table" }>,
  bi: number,
  quote: string,
): Anchor[] {
  if (!quote.trim() || MISSING_QUOTE.test(quote)) return [];
  const cells = tableCells(block);
  const named = cells.filter((c) => quoteNamesCell(quote, c.text));
  const rowsHit = new Set(named.map((c) => c.row));

  if (
    named.length >= 1 &&
    named.length <= 4 &&
    rowsHit.size <= 2 &&
    !quoteIsTableDump(quote)
  ) {
    if (named.length >= 2 && rowsHit.size === 1) {
      return [{ block: bi, row: named[0]!.row, match: "", cover: "row" }];
    }
    return named.map((c) => ({
      block: bi,
      row: c.row,
      col: c.col,
      match: c.text,
      cover: "cell" as const,
    }));
  }

  const headerHits = block.head.filter(
    (h) => h.trim().length >= 4 && locate(quote, h.trim()),
  ).length;
  const involved = named.length > 0 || (quoteIsTableDump(quote) && headerHits >= 2);
  if (involved) return [{ block: bi, match: "", cover: "block" }];
  return [];
}

function collectQuoteAnchors(blocks: Block[], quote: string): Anchor[] {
  const textAnchors: Anchor[] = [];
  const tableAnchors: Anchor[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (!block) continue;
    if (block.type === "table") {
      tableAnchors.push(...collectTableAnchors(block, bi, quote));
      continue;
    }
    const m = matchIn(block.text, quote);
    if (m) textAnchors.push({ block: bi, match: m, cover: "span" });
  }
  if (textAnchors.length) return textAnchors;
  return tableAnchors;
}

function collectSectionAnchors(blocks: Block[], section: string): Anchor[] {
  const anchors: Anchor[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (!block) continue;
    const heading = headingOf(block);
    if (heading && sectionHitsHeading(heading, section)) {
      anchors.push({ block: bi, match: heading, cover: "span" });
    }
  }
  return anchors;
}

function cellText(block: Block, anchor: Pick<Anchor, "row" | "col">): string | null {
  if (block.type === "table") {
    if (anchor.row === -1) return block.head[anchor.col ?? 0] ?? null;
    if (anchor.row != null && anchor.col != null) {
      return block.rows[anchor.row]?.[anchor.col] ?? null;
    }
    return block.head[0] ?? block.rows[0]?.[0] ?? null;
  }
  return block.text;
}

function sliceMatch(text: string, hint: string): string {
  const found = locate(text, hint);
  if (!found) return text.slice(0, Math.min(48, text.length));
  let { start, end } = found;
  while (start > 0 && /[\p{L}\p{N}_-]/u.test(text[start - 1] ?? "")) start -= 1;
  while (end < text.length && /[\p{L}\p{N}_-]/u.test(text[end] ?? "")) end += 1;
  if (end - start < 8) {
    return text.slice(0, Math.min(80, text.length));
  }
  return text.slice(start, Math.min(end, start + 96));
}

function hintsFor(finding: { section: string; ruleId?: string; quote: string }): string[] {
  const extra = Object.entries(RULE_HINTS).flatMap(([id, words]) =>
    finding.ruleId === id ? words : [],
  );
  return [...sectionPieces(finding.section), ...extra].filter(Boolean);
}

function fallbackAnchor(
  blocks: Block[],
  finding: { section: string; ruleId?: string; quote: string },
): Anchor | null {
  const hints = hintsFor(finding);
  for (let bi = 0; bi < blocks.length; bi++) {
    const heading = headingOf(blocks[bi]!);
    if (!heading) continue;
    const h = fold(heading);
    if (hints.some((hint) => h.includes(fold(hint)) || fold(hint).includes(h))) {
      return { block: bi, match: heading, cover: "span" };
    }
  }
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (!block) continue;
    if (block.type === "table") {
      const blob = [
        ...block.head,
        ...block.rows.flat(),
      ].join(" ");
      if (hints.some((hint) => locate(blob, hint))) {
        return { block: bi, match: "", cover: "block" };
      }
      continue;
    }
    const hit = hints.find((hint) => locate(block.text, hint));
    if (hit) return { block: bi, match: sliceMatch(block.text, hit), cover: "span" };
  }
  for (let bi = 0; bi < blocks.length; bi++) {
    const heading = headingOf(blocks[bi]!);
    if (heading) return { block: bi, match: heading, cover: "span" };
  }
  const first = blocks[0];
  if (!first) return null;
  if (first.type === "table") {
    return { block: 0, match: "", cover: "block" };
  }
  return {
    block: 0,
    match: first.text.slice(0, Math.min(48, first.text.length)),
    cover: "span",
  };
}

function pinAnchor(blocks: Block[], anchor: Anchor): Anchor | null {
  const block = blocks[anchor.block];
  if (!block) return null;
  if (anchor.cover === "block" || anchor.cover === "row") return anchor;
  const text = cellText(block, anchor);
  if (!text) return null;
  if (anchor.cover === "cell") return { ...anchor, match: text };
  return { ...anchor, match: sliceMatch(text, anchor.match) };
}

export function commentsFromFindings(
  blocks: Block[],
  findings: Finding[],
): DocComment[] {
  return findings.map((f, n) => {
    const fromQuote = collectQuoteAnchors(blocks, f.quote);
    let raw =
      fromQuote.length > 0
        ? fromQuote
        : collectSectionAnchors(blocks, f.section);
    if (!raw.length) {
      const fallback = fallbackAnchor(blocks, f);
      if (fallback) raw = [fallback];
    }
    const anchors = raw
      .slice(0, 3)
      .map((a) => pinAnchor(blocks, a))
      .filter((a): a is Anchor => !!a);
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
