import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { Block } from "./doc-view";
import {
  reportBlocks,
  statusLabel,
  type ExportComment,
  type ExportReport,
} from "./export-report";

const FONT_REGULAR = [
  path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];
const FONT_BOLD = [
  path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];

const RED = "#C43D33";
const INK = "#1A1A1A";
const MUTED = "#5B6472";
const LINE = "#D6D6D6";
const WASH = "#F4F4F5";
const SEVERITY_HEX: Record<string, string> = {
  HIGH: "#C43D33",
  MEDIUM: "#B54A8A",
  LOW: "#3D7EA6",
};
const SEVERITY_SOFT: Record<string, string> = {
  HIGH: "#F8E8E6",
  MEDIUM: "#F6EAF2",
  LOW: "#E7F0F6",
};
const DOCX_SEVERITY: Record<string, string> = {
  HIGH: "C43D33",
  MEDIUM: "B54A8A",
  LOW: "3D7EA6",
};

function firstExisting(candidates: string[]): string {
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Не найден шрифт с кириллицей для PDF.");
  return found;
}

function clean(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\uFFFD]/g, "")
    .replace(/[→↔➜]/g, "->")
    .replace(/≈/g, "~")
    .replace(/\s+/g, " ")
    .trim();
}

function run(text: string, extra: ConstructorParameters<typeof TextRun>[0] = {}) {
  return new TextRun({ text: clean(text), font: "Calibri", ...extra });
}

const cellBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "D4D4D4",
};

function docxCell(text: string, header = false) {
  return new TableCell({
    borders: {
      top: cellBorder,
      bottom: cellBorder,
      left: cellBorder,
      right: cellBorder,
    },
    shading: header
      ? { type: ShadingType.CLEAR, fill: "F4F4F5" }
      : undefined,
    margins: { top: 50, bottom: 50, left: 70, right: 70 },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        children: [run(text || " ", { bold: header, size: 18 })],
      }),
    ],
  });
}

function docxTable(block: Extract<Block, { type: "table" }>): Table {
  const width = Math.max(block.head.length, ...block.rows.map((r) => r.length), 1);
  const pad = (cells: string[]) => {
    const copy = [...cells];
    while (copy.length < width) copy.push("");
    return copy.slice(0, width);
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: pad(block.head).map((cell) => docxCell(cell, true)),
      }),
      ...block.rows.map(
        (row) =>
          new TableRow({
            children: pad(row).map((cell) => docxCell(cell)),
          }),
      ),
    ],
  });
}

function docxBody(blocks: Block[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.type === "table") {
      out.push(docxTable(block));
      out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
      continue;
    }
    if (block.type === "h1") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 },
          children: [run(block.text)],
        }),
      );
      continue;
    }
    if (block.type === "h2") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 80 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E5E5", space: 4 },
          },
          children: [run(block.text)],
        }),
      );
      continue;
    }
    if (block.type === "h3") {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 60 },
          children: [run(block.text)],
        }),
      );
      continue;
    }
    if (block.type === "li") {
      const mark = block.ordered ? `${block.n ?? 1}.` : "•";
      out.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 280 },
          children: [run(`${mark}  ${block.text}`)],
        }),
      );
      continue;
    }
    out.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [run(block.text)],
      }),
    );
  }
  return out;
}

function commentParagraphs(report: ExportReport): Paragraph[] {
  const out: Paragraph[] = [];
  for (const c of report.comments) {
    const mark = statusLabel(c.status);
    const rule = c.ruleId ? ` · правило ${c.ruleId}` : "";
    out.push(
      new Paragraph({
        spacing: { before: 220, after: 80 },
        children: [
          run(`${c.n}. `, { bold: true }),
          run(c.severity, {
            bold: true,
            color: DOCX_SEVERITY[c.severity] ?? "222222",
          }),
          run(` · ${c.role}${rule}${mark ? ` · ${mark}` : ""}`),
        ],
      }),
      new Paragraph({
        children: [run(c.place, { italics: true, color: "666666" })],
      }),
      new Paragraph({
        children: [
          run("Цитата: ", { bold: true }),
          run(c.quote || "раздел отсутствует"),
        ],
      }),
      new Paragraph({
        children: [run("Почему: ", { bold: true }), run(c.why)],
      }),
      new Paragraph({
        children: [run("Вопрос: ", { bold: true }), run(c.ask)],
      }),
    );
  }
  return out;
}

export async function buildDocx(report: ExportReport): Promise<Buffer> {
  const blocks = reportBlocks(report);
  const doc = new Document({
    creator: "Ревью ТЗ NET",
    title: `Ревью: ${report.title}`,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [run(report.title)],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              run(
                `Замечаний: ${report.counts.total}   HIGH ${report.counts.high}   MEDIUM ${report.counts.medium}   LOW ${report.counts.low}`,
                { color: "555555" },
              ),
            ],
          }),
          ...(report.roleLine
            ? [
                new Paragraph({
                  children: [run(report.roleLine, { color: "555555" })],
                }),
              ]
            : []),
          new Paragraph({
            spacing: { after: 280 },
            children: [run(report.summary)],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [run("Техническое задание")],
          }),
          ...docxBody(blocks),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360 },
            children: [run("Комментарии ревью")],
          }),
          ...(report.comments.length
            ? commentParagraphs(report)
            : [
                new Paragraph({
                  children: [run("Замечаний нет.")],
                }),
              ]),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function wrapLines(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  maxLines = 16,
): string[] {
  const raw = clean(text);
  if (!raw) return [""];
  const tokens = raw.split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) lines.push(cur.trim());
    cur = "";
  };
  const fits = (value: string) => doc.widthOfString(value) <= width;
  for (const token of tokens) {
    if (!token) continue;
    if (fits(cur + token)) {
      cur += token;
      continue;
    }
    push();
    if (lines.length >= maxLines) return lines;
    if (fits(token)) {
      cur = token.trimStart();
      continue;
    }
    let buf = "";
    for (const ch of token) {
      if (buf && !fits(buf + ch)) {
        lines.push(buf);
        buf = ch;
        if (lines.length >= maxLines) return lines;
      } else buf += ch;
    }
    cur = buf;
  }
  push();
  return lines.length ? lines : [""];
}

function annotate(text: string, comments: ExportComment[], kind: "quote" | "heading"): string {
  const t = clean(text);
  const marks: number[] = [];
  for (const c of comments) {
    if (kind === "heading") {
      const place = clean(c.place);
      if (place && (t === place || place.includes(t) || t.includes(place))) {
        marks.push(c.n);
      }
      continue;
    }
    const q = clean(c.quote);
    if (!q || q === "раздел отсутствует") continue;
    const needle = q.slice(0, Math.min(28, q.length));
    if (needle.length >= 8 && t.includes(needle)) marks.push(c.n);
  }
  if (!marks.length) return t;
  return `${t}  [${[...new Set(marks)].join(", ")}]`;
}

export function buildPdf(report: ExportReport): Promise<Buffer> {
  const regular = firstExisting(FONT_REGULAR);
  const bold = firstExisting(FONT_BOLD);
  const blocks = reportBlocks(report);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 48, left: 48, right: 48 },
      info: { Title: `Ревью: ${report.title}`, Author: "Ревью ТЗ NET" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Noto", regular);
    doc.registerFont("Noto-Bold", bold);

    const left = 48;
    const right = doc.page.width - 48;
    const width = right - left;
    const maxY = () => doc.page.maxY() - 2;
    let pageNo = 1;
    let paging = true;

    const use = (face: "regular" | "bold", size: number, color = INK) => {
      doc.font(face === "bold" ? "Noto-Bold" : "Noto").fontSize(size).fillColor(color);
    };

    // PDFKit's text() auto-adds pages when y is near the bottom. That splits
    // table cells onto leftover pages. Positioned draws must never paginate.
    const writeAt = (
      text: string,
      x: number,
      y: number,
      opts: { width?: number; align?: "left" | "right" } = {},
    ) => {
      if (!text) return;
      const prevY = doc.y;
      const prevX = doc.x;
      paging = false;
      try {
        doc.text(text, x, y, {
          width: opts.width,
          align: opts.align,
          lineBreak: false,
          continued: false,
        });
      } finally {
        paging = true;
        doc.y = prevY;
        doc.x = prevX;
      }
    };

    const chrome = () => {
      doc.save();
      doc.rect(0, 0, doc.page.width, 26).fill(RED);
      doc.restore();
      use("bold", 9, "#FFFFFF");
      writeAt("Ревью ТЗ", left, 8);
      use("regular", 9, "#FFFFFF");
      writeAt(String(pageNo), right - 28, 8, { width: 28, align: "right" });
      doc.x = left;
      doc.y = 40;
      use("regular", 10, INK);
    };

    const origAddPage = doc.addPage.bind(doc);
    doc.addPage = ((...args: unknown[]) => {
      if (!paging) return doc;
      const page = origAddPage(...(args as []));
      pageNo += 1;
      chrome();
      return page;
    }) as typeof doc.addPage;

    const newPage = () => {
      origAddPage();
      pageNo += 1;
      chrome();
    };

    const ensure = (height: number) => {
      if (doc.y > 42 && doc.y + height > maxY()) newPage();
    };

    const rule = () => {
      ensure(10);
      const y = doc.y;
      doc.save();
      doc.strokeColor(LINE).lineWidth(0.6).moveTo(left, y).lineTo(right, y).stroke();
      doc.restore();
      doc.y = y + 8;
    };

    chrome();
    use("bold", 16);
    const titleLines = wrapLines(doc, report.title, width, 3);
    for (const line of titleLines) {
      writeAt(line, left, doc.y, { width });
      doc.y += 20;
    }
    doc.y += 2;
    use("regular", 9, MUTED);
    writeAt(
      `Замечаний: ${report.counts.total}    HIGH ${report.counts.high}    MEDIUM ${report.counts.medium}    LOW ${report.counts.low}`,
      left,
      doc.y,
      { width },
    );
    doc.y += 13;
    if (report.roleLine) {
      writeAt(clean(report.roleLine), left, doc.y, { width });
      doc.y += 13;
    }
    doc.y += 2;
    use("regular", 10);
    for (const line of wrapLines(doc, report.summary, width, 8)) {
      ensure(13);
      writeAt(line, left, doc.y, { width });
      doc.y += 13;
    }
    doc.y += 8;
    rule();

    use("bold", 13);
    writeAt("Техническое задание", left, doc.y, { width });
    doc.y += 20;

    const drawParagraph = (
      text: string,
      opts: { size?: number; face?: "regular" | "bold"; gap?: number; indent?: number },
    ) => {
      const size = opts.size ?? 10;
      const face = opts.face ?? "regular";
      const indent = opts.indent ?? 0;
      const lineH = size + 3;
      use(face, size);
      const lines = wrapLines(doc, text, width - indent);
      for (const line of lines) {
        ensure(lineH + 1);
        use(face, size);
        writeAt(line, left + indent, doc.y, { width: width - indent });
        doc.y += lineH;
      }
      doc.y += opts.gap ?? 6;
    };

    const drawTable = (block: Extract<Block, { type: "table" }>) => {
      const cols = Math.max(
        block.head.length,
        ...block.rows.map((r) => r.length),
        1,
      );
      const pad = (cells: string[]) => {
        const copy = cells.map((c) => annotate(c, report.comments, "quote"));
        while (copy.length < cols) copy.push("");
        return copy.slice(0, cols);
      };
      const head = pad(block.head);
      const rows = block.rows.map(pad);
      const weights = Array.from({ length: cols }, (_, i) =>
        Math.max(
          head[i]?.length ?? 0,
          ...rows.map((r) => r[i]?.length ?? 0),
          4,
        ),
      );
      const sum = weights.reduce((a, b) => a + b, 0) || 1;
      const colW = weights.map((w) => Math.max(48, (w / sum) * width));
      const scale = width / colW.reduce((a, b) => a + b, 0);
      const widths = colW.map((w) => w * scale);
      const size = cols >= 6 ? 7 : cols > 4 ? 7.5 : 8.5;
      const cellPad = 4;
      const lineGap = size + 2;

      const cellLines = (cell: string, i: number) => {
        use("regular", size);
        return wrapLines(doc, cell, Math.max(24, widths[i]! - cellPad * 2), 10);
      };

      const rowHeight = (cells: string[]) => {
        let h = 0;
        cells.forEach((cell, i) => {
          h = Math.max(h, cellLines(cell, i).length * lineGap + cellPad * 2);
        });
        return Math.max(h, size + cellPad * 2);
      };

      const paintRow = (cells: string[], header: boolean) => {
        let h = rowHeight(cells);
        if (doc.y > 42 && doc.y + h > maxY()) newPage();
        h = Math.min(h, Math.max(18, maxY() - doc.y));
        let x = left;
        const y = doc.y;
        cells.forEach((cell, i) => {
          const w = widths[i]!;
          doc.save();
          doc.lineWidth(0.6).strokeColor(LINE);
          if (header) doc.rect(x, y, w, h).fillAndStroke(WASH, LINE);
          else doc.rect(x, y, w, h).stroke();
          doc.restore();
          use(header ? "bold" : "regular", size, INK);
          const lines = cellLines(cell, i);
          let ty = y + cellPad;
          for (const line of lines) {
            if (ty + size > y + h - 1) break;
            writeAt(line, x + cellPad, ty, { width: w - cellPad * 2 });
            ty += lineGap;
          }
          x += w;
        });
        doc.x = left;
        doc.y = y + h;
      };

      ensure(rowHeight(head) + 8);
      paintRow(head, true);
      let headOnPage = pageNo;
      for (const row of rows) {
        const h = rowHeight(row);
        const before = pageNo;
        ensure(h + 2);
        if (pageNo !== before && headOnPage !== pageNo) {
          paintRow(head, true);
          headOnPage = pageNo;
        }
        paintRow(row, false);
      }
      doc.y += 10;
    };

    for (const block of blocks) {
      if (block.type === "table") {
        drawTable(block);
        continue;
      }
      if (block.type === "h1") {
        doc.y += 6;
        drawParagraph(annotate(block.text, report.comments, "heading"), {
          size: 15,
          face: "bold",
          gap: 8,
        });
        continue;
      }
      if (block.type === "h2") {
        doc.y += 8;
        drawParagraph(annotate(block.text, report.comments, "heading"), {
          size: 12.5,
          face: "bold",
          gap: 3,
        });
        rule();
        continue;
      }
      if (block.type === "h3") {
        doc.y += 4;
        drawParagraph(annotate(block.text, report.comments, "heading"), {
          size: 11,
          face: "bold",
          gap: 4,
        });
        continue;
      }
      if (block.type === "li") {
        const mark = block.ordered ? `${block.n ?? 1}.` : "•";
        drawParagraph(`${mark}  ${annotate(block.text, report.comments, "quote")}`, {
          size: 10,
          indent: 14,
          gap: 3,
        });
        continue;
      }
      drawParagraph(annotate(block.text, report.comments, "quote"), {
        size: 10,
        gap: 8,
      });
    }

    ensure(80);
    doc.y += 6;
    rule();
    use("bold", 13);
    writeAt("Комментарии ревью", left, doc.y, { width });
    doc.y += 18;

    const drawComment = (c: ExportComment) => {
      const color = SEVERITY_HEX[c.severity] ?? INK;
      const soft = SEVERITY_SOFT[c.severity] ?? WASH;
      const mark = statusLabel(c.status);
      const ruleId = c.ruleId ? ` · правило ${c.ruleId}` : "";
      const title = `${c.n}. ${c.severity} · ${c.role}${ruleId}${mark ? ` · ${mark}` : ""}`;
      const inner = width - 20;
      use("bold", 9);
      const titleLines = wrapLines(doc, title, inner, 3);
      use("regular", 8);
      const placeLines = wrapLines(doc, c.place, inner, 3);
      const quoteLines = wrapLines(doc, `Цитата: ${c.quote || "раздел отсутствует"}`, inner, 5);
      const whyLines = wrapLines(doc, `Почему: ${c.why}`, inner, 6);
      const askLines = wrapLines(doc, `Вопрос: ${c.ask}`, inner, 6);
      const lineCount =
        titleLines.length +
        placeLines.length +
        quoteLines.length +
        whyLines.length +
        askLines.length;
      const h = 16 + lineCount * 11 + 8;
      ensure(Math.min(h, maxY() - 44));
      const y = doc.y;
      const boxH = Math.min(h, maxY() - y);
      doc.save();
      doc.roundedRect(left, y, width, boxH, 4).fill(soft);
      doc.rect(left, y, 4, boxH).fill(color);
      doc.restore();
      let ty = y + 8;
      const write = (lines: string[], face: "regular" | "bold", size: number, col: string) => {
        use(face, size, col);
        for (const line of lines) {
          if (ty + 11 > y + boxH - 4) return;
          writeAt(line, left + 12, ty, { width: inner });
          ty += 11;
        }
      };
      write(titleLines, "bold", 9, color);
      write(placeLines, "regular", 8, MUTED);
      write(quoteLines, "regular", 8, INK);
      write(whyLines, "regular", 8, INK);
      write(askLines, "regular", 8, INK);
      doc.y = y + boxH + 8;
    };

    if (!report.comments.length) {
      use("regular", 10, MUTED);
      writeAt("Замечаний нет.", left, doc.y, { width });
    } else {
      for (const c of report.comments) drawComment(c);
    }

    doc.end();
  });
}
