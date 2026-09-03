import { readFileSync, writeFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { parseBlocks } from "../src/lib/doc-view.ts";
import { buildDocx, buildPdf } from "../src/lib/export-files.ts";
import { pdfBufferToMarkdown } from "../src/lib/pdf-layout.ts";

async function main() {
  const md = await pdfBufferToMarkdown(
    readFileSync("docs/source/Тестовые данные для Хакатона.pdf"),
  );
  const blocks = parseBlocks(md);
  const report = {
    title: "Тестовые данные для Хакатона.pdf",
    summary:
      "Документ лучше не отдавать в разработку: 7 замечаний высокой важности. Закройте high, затем medium.",
    roleLine: "Шаблон, разработчик, QA",
    counts: { high: 1, medium: 1, low: 0, total: 2 },
    comments: [
      {
        n: 1,
        severity: "HIGH",
        role: "Шаблон",
        ruleId: "2",
        place: "Data Catalog",
        quote: "LINK_DASHBOARD_GEO",
        why: "Нет прямой ссылки на Data Catalog.",
        ask: "Добавить ссылку на каталог.",
        status: null,
      },
      {
        n: 2,
        severity: "MEDIUM",
        role: "Разработчик",
        ruleId: "3",
        place: "Структура данных",
        quote: "FIELD_REGION",
        why: "Нет NOT NULL / NULLABLE.",
        ask: "Проставить признак пустоты у каждого поля.",
        status: null,
      },
    ],
    document: md,
    blocks,
  };
  const pdf = await buildPdf(report);
  writeFileSync("/tmp/review-preview.pdf", pdf);
  const docx = await buildDocx(report);
  writeFileSync("/tmp/review-preview.docx", docx);

  const proxy = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(proxy, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  console.log(
    JSON.stringify(
      {
        bytes: pdf.length,
        docx: docx.length,
        blocks: blocks.length,
        tables: blocks.filter((b) => b.type === "table").length,
        totalPages,
        hasMarkdownHeading: pages.some((p) => /## /.test(p)),
        hasMarkdownTable: pages.some((p) => /\| ---/.test(p)),
        hasCommentsSection: pages.some((p) => p.includes("Комментарии ревью")),
        hasTzSection: pages.some((p) => p.includes("Техническое задание")),
        pageStarts: pages.map((p, i) => ({
          n: i + 1,
          chars: p.length,
          start: p.replace(/\s+/g, " ").trim().slice(0, 90),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
