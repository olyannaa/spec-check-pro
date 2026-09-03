import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_DOCS } from "./sample-meta";

export { SAMPLE_DOCS };

export function loadSample(id: string): { title: string; text: string } | null {
  const meta = SAMPLE_DOCS.find((s) => s.id === id);
  if (!meta) return null;
  const text = readFileSync(
    join(process.cwd(), "docs/samples", meta.file),
    "utf8",
  );
  return { title: meta.title, text };
}
