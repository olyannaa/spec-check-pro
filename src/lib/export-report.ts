import { parseBlocks, type Block, type CommentStatus, type DocComment } from "./doc-view";
import { ROLE_LABELS } from "./types";

const SEVERITY_LABEL: Record<DocComment["severity"], string> = {
  3: "HIGH",
  2: "MEDIUM",
  1: "LOW",
};

export type ExportComment = {
  n: number;
  severity: string;
  role: string;
  ruleId?: string;
  place: string;
  quote: string;
  why: string;
  ask: string;
  status: CommentStatus;
};

export type ExportReport = {
  title: string;
  summary: string;
  roleLine: string | null;
  counts: { high: number; medium: number; low: number; total: number };
  comments: ExportComment[];
  document: string;
  blocks: Block[];
};

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      if (block.type === "table") {
        const head = `| ${block.head.join(" | ")} |`;
        const sep = `| ${block.head.map(() => "---").join(" | ")} |`;
        const rows = block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
        return `${head}\n${sep}\n${rows}`;
      }
      if (block.type === "h1") return `# ${block.text}`;
      if (block.type === "h2") return `## ${block.text}`;
      if (block.type === "h3") return `### ${block.text}`;
      if (block.type === "li") {
        return block.ordered ? `${block.n ?? 1}. ${block.text}` : `- ${block.text}`;
      }
      return block.text;
    })
    .join("\n\n")
    .trim();
}

export function buildExportReport(opts: {
  title: string;
  summary: string;
  roleLine: string | null;
  blocks: Block[];
  comments: DocComment[];
  statuses: Record<string, CommentStatus>;
}): ExportReport {
  const comments: ExportComment[] = opts.comments.map((c) => ({
    n: c.n,
    severity: SEVERITY_LABEL[c.severity],
    role: ROLE_LABELS[c.role],
    ruleId: c.ruleId,
    place: c.place,
    quote: c.quote,
    why: c.why,
    ask: c.ask,
    status: opts.statuses[c.id] ?? null,
  }));

  return {
    title: opts.title,
    summary: opts.summary,
    roleLine: opts.roleLine,
    counts: {
      high: opts.comments.filter((c) => c.severity === 3).length,
      medium: opts.comments.filter((c) => c.severity === 2).length,
      low: opts.comments.filter((c) => c.severity === 1).length,
      total: opts.comments.length,
    },
    comments,
    document: blocksToMarkdown(opts.blocks),
    blocks: opts.blocks,
  };
}

export function reportBlocks(report: ExportReport): Block[] {
  if (report.blocks?.length) return report.blocks;
  return parseBlocks(report.document ?? "");
}

export function fileStem(title: string): string {
  const stem = title
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return stem || "TZ";
}

export function statusLabel(status: CommentStatus): string {
  if (status === "accepted") return "принято";
  if (status === "rejected") return "отозвано";
  return "";
}
