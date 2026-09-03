import { DEFAULT_RULES } from "@/lib/rules";

export async function GET() {
  return Response.json({ rules: DEFAULT_RULES });
}
