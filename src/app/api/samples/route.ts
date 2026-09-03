import { SAMPLE_DOCS, loadSample } from "@/lib/samples";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({
      samples: SAMPLE_DOCS.map(({ id, title, hint }) => ({ id, title, hint })),
    });
  }
  const sample = loadSample(id);
  if (!sample) {
    return Response.json({ error: "Пример не найден" }, { status: 404 });
  }
  return Response.json(sample);
}
