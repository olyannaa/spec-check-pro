import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { statusLabel, type ExportReport } from "./export-report";

const FONT_CANDIDATES = [
  path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "C43D33",
  MEDIUM: "B54A8A",
  LOW: "3D7EA6",
};

function fontPath(): string {
  const found = FONT_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Не найден шрифт с кириллицей для PDF.");
  return found;
}

function run(text: string, extra: ConstructorParameters<typeof TextRun>[0] = {}) {
  return new TextRun({ text, font: "Arial", ...extra });
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
            color: SEVERITY_COLOR[c.severity] ?? "222222",
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
  const doc = new Document({
    creator: "Ревью ТЗ NET",
    title: `Ревью: ${report.title}`,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [run(`Ревью ТЗ: ${report.title}`)],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              run(
                `Замечаний: ${report.counts.total}  HIGH ${report.counts.high}  MEDIUM ${report.counts.medium}  LOW ${report.counts.low}`,
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
            heading: HeadingLevel.HEADING_2,
            children: [run("Комментарии")],
          }),
          ...(report.comments.length
            ? commentParagraphs(report)
            : [
                new Paragraph({
                  children: [run("Замечаний нет.")],
                }),
              ]),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 360 },
            children: [run("Текст ТЗ")],
          }),
          ...report.document.split("\n").map(
            (line) =>
              new Paragraph({
                spacing: { after: 40 },
                children: [run(line.length ? line : " ")],
              }),
          ),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export function buildPdf(report: ExportReport): Promise<Buffer> {
  const font = fontPath();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: `Ревью: ${report.title}`, Author: "Ревью ТЗ NET" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(font);
    doc.fontSize(16).text(`Ревью ТЗ: ${report.title}`);
    doc.moveDown(0.4);
    doc
      .fontSize(10)
      .fillColor("#444444")
      .text(
        `Замечаний: ${report.counts.total}   HIGH ${report.counts.high}   MEDIUM ${report.counts.medium}   LOW ${report.counts.low}`,
      );
    if (report.roleLine) doc.text(report.roleLine);
    doc.moveDown(0.4);
    doc.fillColor("#111111").fontSize(11).text(report.summary, { align: "left" });
    doc.moveDown(0.8);
    doc.fontSize(13).text("Комментарии");
    doc.moveDown(0.3);

    if (!report.comments.length) {
      doc.fontSize(11).text("Замечаний нет.");
    } else {
      for (const c of report.comments) {
        const mark = statusLabel(c.status);
        const rule = c.ruleId ? ` · правило ${c.ruleId}` : "";
        doc
          .fontSize(11)
          .fillColor("#111111")
          .text(
            `${c.n}. ${c.severity} · ${c.role}${rule}${mark ? ` · ${mark}` : ""}`,
          );
        doc.fontSize(10).fillColor("#555555").text(c.place);
        doc.fillColor("#111111").text(`Цитата: ${c.quote || "раздел отсутствует"}`);
        doc.text(`Почему: ${c.why}`);
        doc.text(`Вопрос: ${c.ask}`);
        doc.moveDown(0.45);
      }
    }

    doc.addPage();
    doc.font(font).fontSize(13).fillColor("#111111").text("Текст ТЗ");
    doc.moveDown(0.4);
    doc.fontSize(10).text(report.document || " ", { align: "left" });
    doc.end();
  });
}
