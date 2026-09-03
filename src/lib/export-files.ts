import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
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
import { reportBlocks, type ExportReport } from "./export-report";

const FONT_REGULAR = [
  path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];
const FONT_BOLD = [
  path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];

const INK = "#000000";
const BORDER = "#000000";

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
  size: 8,
  color: "000000",
};

function docxCell(text: string, header = false) {
  return new TableCell({
    borders: {
      top: cellBorder,
      bottom: cellBorder,
      left: cellBorder,
      right: cellBorder,
    },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        children: [run(text || " ", { bold: header, size: 20 })],
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
      out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
      continue;
    }
    if (block.type === "h1") {
      out.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [run(block.text, { bold: true, size: 28 })],
        }),
      );
      continue;
    }
    if (block.type === "h2") {
      out.push(
        new Paragraph({
          spacing: { before: 280, after: 80 },
          children: [run(block.text, { bold: true, size: 24 })],
        }),
      );
      continue;
    }
    if (block.type === "h3") {
      out.push(
        new Paragraph({
          spacing: { before: 200, after: 60 },
          children: [run(block.text, { bold: true, size: 22 })],
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
          children: [run(`${mark}  ${block.text}`, { size: 22 })],
        }),
      );
      continue;
    }
    out.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [run(block.text, { size: 22 })],
      }),
    );
  }
  return out.length
    ? out
    : [new Paragraph({ children: [run("Документ пуст.")] })];
}

export async function buildDocx(report: ExportReport): Promise<Buffer> {
  const blocks = reportBlocks(report);
  const doc = new Document({
    creator: "Ревью ТЗ NET",
    title: report.title,
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: docxBody(blocks),
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

export function buildPdf(report: ExportReport): Promise<Buffer> {
  const regular = firstExisting(FONT_REGULAR);
  const bold = firstExisting(FONT_BOLD);
  const blocks = reportBlocks(report);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: { Title: report.title, Author: "Ревью ТЗ NET" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Noto", regular);
    doc.registerFont("Noto-Bold", bold);

    const left = 56;
    const width = doc.page.width - 112;
    const maxY = () => doc.page.maxY() - 2;
    let paging = true;

    const use = (face: "regular" | "bold", size: number) => {
      doc.font(face === "bold" ? "Noto-Bold" : "Noto").fontSize(size).fillColor(INK);
    };

    const writeAt = (
      text: string,
      x: number,
      y: number,
      opts: { width?: number } = {},
    ) => {
      if (!text) return;
      const prevY = doc.y;
      const prevX = doc.x;
      paging = false;
      try {
        doc.text(text, x, y, {
          width: opts.width,
          lineBreak: false,
          continued: false,
        });
      } finally {
        paging = true;
        doc.y = prevY;
        doc.x = prevX;
      }
    };

    const origAddPage = doc.addPage.bind(doc);
    doc.addPage = ((...args: unknown[]) => {
      if (!paging) return doc;
      return origAddPage(...(args as []));
    }) as typeof doc.addPage;

    const newPage = () => origAddPage();

    const ensure = (height: number) => {
      if (doc.y > 58 && doc.y + height > maxY()) newPage();
    };

    use("regular", 11);
    doc.x = left;
    doc.y = 56;

    const drawParagraph = (
      text: string,
      opts: { size?: number; face?: "regular" | "bold"; gap?: number; indent?: number },
    ) => {
      const size = opts.size ?? 11;
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
        const copy = cells.map((c) => clean(c));
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
      const size = cols >= 6 ? 8 : cols > 4 ? 9 : 10;
      const cellPad = 5;
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
        if (doc.y > 58 && doc.y + h > maxY()) newPage();
        h = Math.min(h, Math.max(18, maxY() - doc.y));
        let x = left;
        const y = doc.y;
        cells.forEach((cell, i) => {
          const w = widths[i]!;
          doc.save();
          doc.lineWidth(0.8).strokeColor(BORDER).rect(x, y, w, h).stroke();
          doc.restore();
          use(header ? "bold" : "regular", size);
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
      for (const row of rows) {
        const h = rowHeight(row);
        if (doc.y > 58 && doc.y + h > maxY()) {
          newPage();
          paintRow(head, true);
        }
        paintRow(row, false);
      }
      doc.y += 12;
    };

    for (const block of blocks) {
      if (block.type === "table") {
        drawTable(block);
        continue;
      }
      if (block.type === "h1") {
        doc.y += 4;
        drawParagraph(block.text, { size: 16, face: "bold", gap: 8 });
        continue;
      }
      if (block.type === "h2") {
        doc.y += 10;
        drawParagraph(block.text, { size: 13, face: "bold", gap: 4 });
        continue;
      }
      if (block.type === "h3") {
        doc.y += 6;
        drawParagraph(block.text, { size: 12, face: "bold", gap: 4 });
        continue;
      }
      if (block.type === "li") {
        const mark = block.ordered ? `${block.n ?? 1}.` : "•";
        drawParagraph(`${mark}  ${block.text}`, {
          size: 11,
          indent: 18,
          gap: 2,
        });
        continue;
      }
      drawParagraph(block.text, { size: 11, gap: 8 });
    }

    if (!blocks.length) {
      use("regular", 11);
      writeAt("Документ пуст.", left, doc.y, { width });
    }

    doc.end();
  });
}
