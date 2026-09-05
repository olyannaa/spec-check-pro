import { readFileSync } from "node:fs";
import { pdfBufferToMarkdown } from "../src/lib/pdf-layout";
import { parseBlocks } from "../src/lib/doc-view";
import { formatSpecText } from "../src/lib/format-doc";

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

async function main() {
  const md = await pdfBufferToMarkdown(
    readFileSync("docs/source/Тестовые данные для Хакатона.pdf"),
  );
  const blocks = parseBlocks(md);
  const types = blocks.reduce(
    (a, b) => {
      a[b.type] = (a[b.type] || 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );

  if (!md.includes("## Описание")) fail("missing heading Описание");
  if (!md.includes("| Регион | Топик 3G | Топик 4G |")) fail("missing kafka table");
  if (!md.includes("| FIELD_REGION | string | Регион |")) fail("missing field table");
  if (!md.includes("FIELD_REGION_NAME")) fail("missing CDM field");
  if (!md.includes("| Требование | Значение |")) fail("missing requirements table");
  if (!md.includes("- Задержка:")) fail("missing bullet");
  if (md.includes("Общие сведения Модуль")) fail("heading still mashed with body");
  if ((types.table ?? 0) < 6) fail(`too few tables: ${types.table}`);
  if ((types.h2 ?? 0) < 15) fail(`too few h2: ${types.h2}`);

  const mashed = blocks.find(
    (b) =>
      b.type === "p" &&
      "text" in b &&
      b.text.includes("Общие сведения Модуль"),
  );
  if (mashed) fail("parseBlocks mashed heading");

  const sample = readFileSync("docs/samples/01-potok-geo.md", "utf8");
  const formatted = formatSpecText(sample);
  if (!formatted.includes("## Общие сведения")) fail("sample lost heading");
  if (!formatted.includes("| Регион |")) fail("sample lost table");

  const flat =
    "Описание: Пример данных состоит из 3 примеров документов: 1. Описание потоков данных. 2. Описание данных системы источника. 3. Описание витрины-агрегата. Все данные в документах обезличены. Основная цель – разработать систему. Тестирование работы алгоритма будет проходить на новом документе. Общие сведения Модуль обеспечивает получение сведений о текущем и историческом местоположении абонентских устройств в реальном времени.";
  const restored = formatSpecText(flat);
  if (!restored.includes("## Общие сведения")) fail("flat missing heading");
  if (!restored.includes("1. Описание потоков данных.")) fail("flat missing list");
  if (restored.includes("## Пример данных")) fail("false heading Пример данных");
  if ((restored.match(/^## Описание$/m) ?? []).length > 1) {
    fail("описание over-split");
  }

  console.log("OK", types);
  console.log("--- preview ---\n" + md.slice(0, 900));
}

main();
