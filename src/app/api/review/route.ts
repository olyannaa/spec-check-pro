import { extractText, getDocumentProxy } from "unpdf";
import { reviewDocument } from "@/lib/review";
import { DEFAULT_RULES } from "@/lib/rules";
import type { Rule } from "@/lib/types";

export const runtime = "nodejs";

async function pdfToText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let text = "";
  let fileName = "";
  let rules: Rule[] = DEFAULT_RULES;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const rawRules = form.get("rules");
    if (typeof rawRules === "string" && rawRules.trim()) {
      try {
        rules = JSON.parse(rawRules) as Rule[];
      } catch {
        rules = DEFAULT_RULES;
      }
    }
    if (file instanceof File) {
      fileName = file.name;
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".pdf")) {
        text = await pdfToText(buf);
      } else {
        text = buf.toString("utf8");
      }
    }
    const pasted = form.get("text");
    if (typeof pasted === "string" && pasted.trim()) {
      text = `${text}\n${pasted}`.trim();
    }
  } else {
    const body = (await req.json()) as {
      text?: string;
      rules?: Rule[];
      fileName?: string;
    };
    text = body.text ?? "";
    fileName = body.fileName ?? "";
    if (body.rules?.length) rules = body.rules;
  }

  if (!text.trim()) {
    return Response.json(
      { error: "Пустой документ. Вставьте текст или приложите PDF." },
      { status: 400 },
    );
  }

  const result = await reviewDocument(text, rules);
  return Response.json({ ...result, fileName });
}
