/** Section titles from the NET template, samples, and hackathon PDFs. */

const SECTION_TITLES = [
  "описание",
  "общие сведения",
  "решаемая проблема",
  "продуктовые метрики",
  "заказчики",
  "нефункциональные требования",
  "системы-источники",
  "системы источники",
  "схема потоков данных",
  "jira",
  "команда",
  "источники и приемники данных",
  "источники и приёмники данных",
  "источники данных",
  "источники обогащения данных",
  "приемники данных",
  "приёмники данных",
  "приемники",
  "приёмники",
  "структура данных",
  "структура данных cdm",
  "дополнительная информация",
  "алгоритм обработки потока",
  "алгоритм расчёта",
  "алгоритм расчета",
  "формирование ключа",
  "пример данных",
  "ddl",
  "faq",
  "бизнес-требования",
  "способ загрузки",
  "регламент",
  "глубина данных",
  "требования к агрегату",
  "документы",
  "основные места, на которые надо обратить внимание",
];

const TITLE_SET = new Set(SECTION_TITLES);

export function normalizeHeading(line: string): string {
  return line
    .replace(/^#{1,3}\s+/, "")
    .replace(/\s*:\s*/g, ": ")
    .trim()
    .replace(/:$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function isKnownHeading(title: string): boolean {
  const n = normalizeHeading(title);
  if (TITLE_SET.has(n)) return true;
  if (n.startsWith("faq")) return true;
  if (/^таблица:\s+\S/.test(n)) return true;
  if (/^шаг\s+\d+\./.test(n)) return true;
  return false;
}

/** Numbered template sections like «1. Источники данных», not list sentences. */
export function isNumberedSectionTitle(line: string): boolean {
  const t = line.replace(/^#{1,3}\s+/, "").trim();
  const m = t.match(/^\d+\.\s+(.+)$/);
  if (!m?.[1]) return false;
  const rest = m[1].trim();
  if (/[.!?…]$/.test(rest)) return false;
  if (rest.length > 80) return false;
  return isKnownHeading(rest) || rest.length < 55;
}

export function isSectionHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith("|")) return false;
  if (/^#{1,3}\s+\S/.test(t)) return true;
  if (isNumberedSectionTitle(t)) return true;
  if (/^[-•*]\s+/.test(t) || /^\s*/.test(t)) return false;
  return isKnownHeading(t);
}

export function headingLevel(line: string): 1 | 2 | 3 | 0 {
  if (!isSectionHeading(line)) return 0;
  const t = line.replace(/^#{1,3}\s+/, "").trim();
  if (/^таблица:/i.test(t)) return 3;
  if (/^шаг\s+\d+/i.test(t)) return 3;
  const n = normalizeHeading(t);
  if (
    n === "приемники" ||
    n === "приёмники" ||
    n === "документы" ||
    n === "источники данных"
  ) {
    return 3;
  }
  return 2;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const HEADING_PATTERNS = [...SECTION_TITLES].sort(
  (a, b) => b.length - a.length,
);
