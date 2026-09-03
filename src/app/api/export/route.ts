import { buildDocx, buildPdf } from "@/lib/export-files";
import type { ExportReport } from "@/lib/export-report";
import { fileStem } from "@/lib/export-report";

export const runtime = "nodejs";

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    format?: string;
    report?: ExportReport;
  };
  const format = body.format === "pdf" ? "pdf" : body.format === "docx" ? "docx" : null;
  if (!format || !body.report?.title) {
    return Response.json(
      { error: "Нужны format (docx|pdf) и отчёт ревью." },
      { status: 400 },
    );
  }

  const bytes =
    format === "pdf" ? await buildPdf(body.report) : await buildDocx(body.report);
  const name = `${fileStem(body.report.title)}_ревью.${format}`;

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
