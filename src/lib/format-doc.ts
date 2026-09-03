import {
  escapeRegExp,
  HEADING_PATTERNS,
  headingLevel,
  isSectionHeading,
} from "./headings";

const PARA_STARTS = [
  "Все данные в документах",
  "Основная цель",
  "Тестирование работы алгоритма",
  "Работа носит творческий характер",
  "Метрика –",
  "Метрика -",
  "В случае необходимости",
];

export function looksLikeMarkdown(text: string): boolean {
  const headings = text.match(/^#{1,3} /gm)?.length ?? 0;
  const hasTable = /^\|/m.test(text) && /\| -{2,}/.test(text);
  return headings >= 3 || (headings >= 1 && hasTable);
}

function normalizeBullets(text: string): string {
  return text
    .replace(/^[ \t]*[•◦▪]\s*/gm, "- ")
    .replace(/^[ \t]+(?=[-*] )/gm, "");
}

function breakFlatText(text: string): string {
  let t = text.replace(/[ \t]+/g, " ").trim();
  t = t.replace(/:\s+(?=\d{1,2}\.\s+[А-ЯA-Z])/g, ":\n");
  t = t.replace(
    /(?<=\d{1,2}\.\s+[^\n]{2,90}?\.)\s+(?=\d{1,2}\.\s+[А-ЯA-Z])/g,
    "\n",
  );
  t = t.replace(
    /(?<=\d{1,2}\.\s+[^\n]{2,90}?\.)\s+(?=[А-ЯA-Z][^\n]{12,})/g,
    "\n\n",
  );
  for (const title of HEADING_PATTERNS) {
    if (title.length < 12) continue;
    const re = new RegExp(
      `(^|[.!?…]\\s+)(${escapeRegExp(title)})(?=\\s+[А-ЯA-Z0-9«"'(])`,
      "gi",
    );
    t = t.replace(re, "$1\n\n$2\n");
  }
  for (const start of PARA_STARTS) {
    const re = new RegExp(`(?<=[.!?])\\s+(${escapeRegExp(start)})`, "g");
    t = t.replace(re, "\n\n$1");
  }
  return t;
}

function promoteHeadings(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^#{1,3}\s/.test(trimmed) || trimmed.startsWith("|")) return line;
      for (const title of HEADING_PATTERNS) {
        const m = trimmed.match(
          new RegExp(`^(${escapeRegExp(title)}):\\s+(.+)$`, "i"),
        );
        if (m?.[2] && m[2].length > 24) {
          const level = headingLevel(m[1]) || 2;
          return `${"#".repeat(level)} ${m[1]}\n\n${m[2]}`;
        }
      }
      const level = headingLevel(trimmed);
      if (!level) return line;
      return `${"#".repeat(level)} ${trimmed.replace(/:$/, "")}`;
    })
    .join("\n");
}

function collapseBlankLines(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Restore headings, lists and paragraphs in extracted PDF / pasted text. */
export function formatSpecText(text: string): string {
  let t = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  t = normalizeBullets(t);
  if (looksLikeMarkdown(t)) return collapseBlankLines(t);
  const newlineRatio = (t.match(/\n/g)?.length ?? 0) / Math.max(t.length, 1);
  if (newlineRatio < 0.004) t = breakFlatText(t);
  t = promoteHeadings(t);
  return collapseBlankLines(t);
}

export { isSectionHeading, headingLevel };
