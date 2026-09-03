import {
  extractText,
  extractTextItems,
  getDocumentProxy,
  type StructuredTextItem,
} from "unpdf";
import { formatSpecText } from "./format-doc";
import { headingLevel, isSectionHeading } from "./headings";

type Line = {
  page: number;
  y: number;
  fontSize: number;
  items: StructuredTextItem[];
};

const GAP_TABLE = 20;
const Y_TOL = 3.6;

function textItems(line: Line): StructuredTextItem[] {
  return line.items.filter((it) => it.str.trim()).sort((a, b) => a.x - b.x);
}

function maxGap(line: Line): number {
  const texts = textItems(line);
  let gap = 0;
  for (let i = 1; i < texts.length; i++) {
    const prev = texts[i - 1]!;
    gap = Math.max(gap, texts[i]!.x - (prev.x + prev.width));
  }
  return gap;
}

function isTableLine(line: Line): boolean {
  return textItems(line).length >= 2 && maxGap(line) > GAP_TABLE;
}

function clusterXs(xs: number[], tol = 14): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const x of sorted) {
    const g = groups[groups.length - 1];
    if (g && x - g[g.length - 1]! <= tol) g.push(x);
    else groups.push([x]);
  }
  return groups.map((g) => g[0]!);
}

function inferColumns(lines: Line[]): number[] {
  const xs = lines.flatMap((l) => textItems(l).map((it) => it.x));
  const cols = clusterXs(xs, 16);
  return cols.length >= 2 ? cols : [];
}

function assignCells(line: Line, columns: number[]): string[] {
  const cells = columns.map(() => "");
  for (const it of textItems(line)) {
    let idx = 0;
    for (let i = 0; i < columns.length; i++) {
      const next = columns[i + 1];
      if (it.x + 8 >= columns[i]! && (next === undefined || it.x + 8 < next)) {
        idx = i;
        break;
      }
    }
    const piece = it.str.replace(/\s+/g, " ").trim();
    cells[idx] = cells[idx] ? `${cells[idx]} ${piece}` : piece;
  }
  return cells;
}

function joinFragment(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;
  if (/[-–]$/.test(prev)) return prev + next;
  if (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]/.test(next)) return prev + next;
  const start = next.match(/^[A-Za-zА-Яа-яЁё0-9_]+/)?.[0] ?? "";
  if (start.length <= 2 && /[А-Яа-яЁё]$/.test(prev) && /^[а-яё]/i.test(next)) {
    return prev + next;
  }
  return `${prev} ${next}`;
}

function isContinuationRow(cells: string[]): boolean {
  const first = cells[0] ?? "";
  if (!first) return true;
  if (/^[)\].,;:]/.test(first)) return true;
  if (/^[а-яёa-z]/.test(first) && first.length < 24) return true;
  return false;
}

function tidyText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/ +([.,;:)%])/g, "$1")
    .replace(/\( +/g, "(")
    .replace(/ :/g, ":")
    .trim();
}

function lineText(line: Line): string {
  let s = "";
  const items = [...line.items].sort((a, b) => a.x - b.x);
  for (const it of items) {
    if (/^\s+$/.test(it.str)) {
      if (s && !s.endsWith(" ")) s += " ";
      continue;
    }
    if (!it.str) continue;
    if (!s) {
      s = it.str;
      continue;
    }
    if (/[-–/]$/.test(s) || /^[-–/,]/.test(it.str)) s += it.str;
    else if (s.endsWith(" ") || it.str.startsWith(" ")) s += it.str.trimStart();
    else s += ` ${it.str}`;
  }
  return tidyText(s);
}

function buildLines(pages: StructuredTextItem[][]): Line[] {
  const lines: Line[] = [];
  pages.forEach((page, pageIdx) => {
    const rows: Line[] = [];
    const sorted = [...page].sort((a, b) => b.y - a.y || a.x - b.x);
    for (const it of sorted) {
      if (!it.str) continue;
      const last = rows[rows.length - 1];
      const tol = Math.max(Y_TOL, (it.height || it.fontSize) * 0.3);
      if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
      else {
        rows.push({
          page: pageIdx,
          y: it.y,
          fontSize: it.fontSize,
          items: [it],
        });
      }
    }
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const sized = row.items.filter((it) => it.str.trim());
      row.fontSize =
        sized.reduce((s, it) => s + it.fontSize, 0) / Math.max(sized.length, 1);
      lines.push(row);
    }
  });
  return lines;
}

function toMarkdownTable(rows: string[][]): string {
  if (!rows[0]) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => {
    const copy = r.map((c) => c.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim());
    while (copy.length < width) copy.push("");
    return copy;
  });
  const head = padded[0]!;
  const body = padded.slice(1).filter((r) => r.some((c) => c));
  if (!body.length && head.every((c) => !c)) return "";
  const sep = head.map(() => "---");
  const fmt = (r: string[]) => `| ${r.join(" | ")} |`;
  return [fmt(head), fmt(sep), ...body.map(fmt)].join("\n");
}

function emitHeading(text: string): string {
  const level = headingLevel(text) || 2;
  const title = tidyText(text).replace(/:$/, "");
  return `${"#".repeat(level)} ${title}`;
}

function emitLine(text: string): string {
  const bullet = text.match(/^[•◦▪]\s*(.*)$/);
  if (bullet) return `- ${bullet[1]}`.trim();
  if (isSectionHeading(text)) return emitHeading(text);
  return text;
}

function consumeTable(lines: Line[], start: number): { md: string; end: number } {
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end]!;
    if (isSectionHeading(lineText(line)) && !isTableLine(line)) break;
    if (isTableLine(line)) {
      end += 1;
      continue;
    }
    const cols = inferColumns(lines.slice(start, end));
    if (cols.length >= 2 && isTableContinuation(line, cols)) {
      end += 1;
      continue;
    }
    break;
  }
  const slice = lines.slice(start, end);
  const columns = inferColumns(slice);
  if (columns.length < 2) {
    return { md: emitLine(lineText(lines[start]!)), end: start + 1 };
  }
  const rows: string[][] = [];
  for (const line of slice) {
    const cells = assignCells(line, columns);
    if (rows.length && isContinuationRow(cells)) {
      const last = rows[rows.length - 1]!;
      for (let c = 0; c < cells.length; c++) {
        if (cells[c]) last[c] = joinFragment(last[c] ?? "", cells[c]!);
      }
    } else {
      rows.push(cells);
    }
  }
  return { md: toMarkdownTable(rows), end };
}

function isTableContinuation(line: Line, columns: number[]): boolean {
  if (isSectionHeading(lineText(line)) && !isTableLine(line)) return false;
  const texts = textItems(line);
  if (!texts.length) return false;
  if (line.fontSize > 13 && maxGap(line) < GAP_TABLE && texts.length <= 2) {
    const left = texts[0]!.x;
    if (left < columns[0]! + 10 && texts.length === 1 && !isTableLine(line)) {
      return false;
    }
  }
  const cells = assignCells(line, columns);
  if (isContinuationRow(cells)) return true;
  return isTableLine(line);
}

export function itemsToMarkdown(pages: StructuredTextItem[][]): string {
  const lines = buildLines(pages);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isTableLine(line)) {
      const { md, end } = consumeTable(lines, i);
      if (md) out.push(md);
      i = end;
      continue;
    }
    const text = lineText(line);
    if (!text) {
      i += 1;
      continue;
    }
    const emitted = emitLine(text);
    const prev = lines[i - 1];
    const dy = prev && prev.page === line.page ? prev.y - line.y : 99;
    const prevOut = out[out.length - 1];
    const wrap =
      dy < 22 &&
      Boolean(prevOut) &&
      !emitted.startsWith("#") &&
      !emitted.startsWith("|") &&
      !emitted.startsWith("- ") &&
      !/^\d+\.\s+/.test(emitted) &&
      !prevOut!.startsWith("#") &&
      !prevOut!.startsWith("|") &&
      !/^\d+\.\s+/.test(prevOut!);
    if (wrap) out[out.length - 1] = tidyText(`${prevOut} ${emitted}`);
    else out.push(emitted);
    i += 1;
  }
  return out.join("\n\n");
}

export async function pdfBufferToMarkdown(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  try {
    const { items } = await extractTextItems(pdf);
    const md = itemsToMarkdown(items);
    if (md.trim().length > 40) return formatSpecText(md);
  } catch {
    /* fall through */
  }
  const { text } = await extractText(pdf, { mergePages: true });
  const raw = Array.isArray(text) ? text.join("\n") : text;
  return formatSpecText(raw);
}
