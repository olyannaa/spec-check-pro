import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block, ReviewDoc } from "@/data/types";

function cell(text: string, width: number, bold = false) {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  return new TableCell({
    borders: { top: b, bottom: b, left: b, right: b },
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
  });
}

export async function downloadDocx(title: string, blocks: Block[]) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] }),
  ];

  for (const block of blocks) {
    if (block.type === "table") {
      const total = 9360;
      const cols = block.head.length;
      const w = Math.floor(total / cols);
      const widths = block.head.map((_, i) => (i === cols - 1 ? total - w * (cols - 1) : w));
      children.push(
        new Table({
          width: { size: total, type: WidthType.DXA },
          columnWidths: widths,
          rows: [
            new TableRow({ children: block.head.map((h, i) => cell(h, widths[i]!, true)) }),
            ...block.rows.map(
              (r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i]!)) }),
            ),
          ],
        }),
      );
      children.push(new Paragraph({ children: [new TextRun("")] }));
    } else if (block.type === "h2") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(block.text)] }),
      );
    } else if (block.type === "h3") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(block.text)] }),
      );
    } else if (block.type === "li") {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: block.text, size: 22 })],
        }),
      );
    } else {
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
          children: [new TextRun({ text: block.text, size: 22 })],
        }),
      );
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf() {
  window.print();
}

export function docToPlainText(doc: ReviewDoc, blocks: Block[]) {
  const lines = [doc.title, ""];
  for (const b of blocks) {
    if (b.type === "table") {
      lines.push(b.head.join(" | "));
      b.rows.forEach((r) => lines.push(r.join(" | ")));
      lines.push("");
    } else if (b.type === "li") {
      lines.push("• " + b.text);
    } else {
      lines.push(b.text, "");
    }
  }
  return lines.join("\n");
}
