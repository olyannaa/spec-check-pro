export type ParsedDoc = {
  raw: string;
  body: string;
  sections: { title: string; text: string }[];
  lower: string;
};

const HISTORY_RE = /история\s+изменений[\s\S]*$/i;

export function stripHistory(text: string): string {
  return text.replace(HISTORY_RE, "").trim();
}

export function parseDocument(text: string): ParsedDoc {
  const raw = text.replace(/\r\n/g, "\n").trim();
  const body = stripHistory(raw);
  const sections: { title: string; text: string }[] = [];
  const lines = body.split("\n");
  let current = "Документ";
  let buf: string[] = [];

  const flush = () => {
    const textBlock = buf.join("\n").trim();
    if (textBlock || current !== "Документ") {
      sections.push({ title: current, text: textBlock });
    }
    buf = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const numbered = line.match(/^(\d+)\.\s+([А-ЯA-Z].{3,80})$/);
    if (heading) {
      flush();
      current = heading[1].trim();
      continue;
    }
    if (numbered && numbered[2].length < 80) {
      flush();
      current = numbered[2].trim();
      continue;
    }
    buf.push(line);
  }
  flush();

  return { raw, body, sections, lower: body.toLowerCase() };
}

export function snippet(text: string, max = 180): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "раздел отсутствует";
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

export function hasAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

export function findLine(text: string, pattern: RegExp): string | undefined {
  return text.split("\n").find((line) => pattern.test(line))?.trim();
}
