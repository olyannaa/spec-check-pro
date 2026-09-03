import type { Finding, ReviewResult, Rule, Verdict } from "./types";

const FREE_MODEL = "qwen/qwen3.8-27b";
const FREE_BASE = "https://api.groq.com/openai/v1";

function extractJson(text: string): { findings?: Finding[] } | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).replace(/<think>[\s\S]*?<\/think>/gi, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as { findings?: Finding[] };
  } catch {
    return null;
  }
}

function env(name: string): string | undefined {
  return process.env[name];
}

export async function enrichWithQwen(
  document: string,
  rules: Rule[],
  seed: Finding[],
): Promise<{ findings: Finding[]; used: boolean; model: string }> {
  const groqKey = env("GROQ_API_KEY");
  const apiKey = groqKey ?? env("OPENAI_API_KEY") ?? env("DASHSCOPE_API_KEY");
  const baseUrl = env("OPENAI_BASE_URL") ?? FREE_BASE;
  const model = env("OPENAI_MODEL") ?? FREE_MODEL;

  if (!apiKey) {
    return { findings: seed, used: false, model };
  }

  const rulesBlock = rules
    .map((r) => `${r.id}. ${r.title}: ${r.lookFor} Вопрос: ${r.askIfMissing}`)
    .join("\n");

  const prompt = `Ты проверяешь техническое задание на поток или витрину данных продукта NET.
Не исправляй текст. Только находи места, которые разработчик или тестировщик попросит уточнить.
Лучше 10 придирок, чем пропуск. Каждая находка — про ЭТОТ документ, с цитатой.
Не комментируй раздел «История изменений».
Не предлагай готовую замену абзаца.

Обязательные правила:
${rulesBlock}

Уже найденные замечания (не повторяй, добавь пропущенные):
${JSON.stringify(seed.map((f) => ({ section: f.section, ask: f.ask, quote: f.quote })))}

Верни JSON:
{"findings":[{"severity":"high"|"medium"|"low","ruleId":"1-8 или пусто","section":"","quote":"","why":"","ask":"","role":"template"|"developer"|"qa"}]}

ТЗ:
"""${document.slice(0, 24000)}"""`;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "NET-SpecCheck/1.0",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        reasoning_format: "hidden",
        messages: [
          {
            role: "system",
            content:
              "Ты ревьюер документации NET. Отвечаешь только JSON. Русский язык. Без размышлений.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("LLM request failed", res.status, errText.slice(0, 300));
      return { findings: seed, used: false, model };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const extra = (parsed?.findings ?? []).map((f, i) => ({
      id: `llm-${i + 1}`,
      severity: f.severity ?? "medium",
      ruleId: f.ruleId,
      section: f.section || "Документ",
      quote: f.quote || "раздел отсутствует",
      why: f.why || "",
      ask: f.ask || "",
      role: f.role ?? "developer",
    }));
    return { findings: mergeFindings(seed, extra), used: true, model };
  } catch (err) {
    console.warn("LLM request error", err);
    return { findings: seed, used: false, model };
  }
}

function mergeFindings(seed: Finding[], extra: Finding[]): Finding[] {
  const seen = new Set(
    seed.map((f) => `${f.ruleId ?? ""}|${normalize(f.ask)}|${normalize(f.quote)}`),
  );
  const out = [...seed];
  for (const f of extra) {
    if (!f.ask || !f.why) continue;
    const key = `${f.ruleId ?? ""}|${normalize(f.ask)}|${normalize(f.quote)}`;
    if (seen.has(key)) continue;
    if (tooGeneric(f)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

function tooGeneric(f: Finding): boolean {
  const t = `${f.why} ${f.ask}`.toLowerCase();
  return (
    t.includes("уточните требования") && t.length < 80 && !f.quote.includes(" ")
  );
}

export function finalizeReview(
  findings: Finding[],
  usedLlm: boolean,
  model: string = FREE_MODEL,
): ReviewResult {
  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...findings].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
  const counts = {
    high: sorted.filter((f) => f.severity === "high").length,
    medium: sorted.filter((f) => f.severity === "medium").length,
    low: sorted.filter((f) => f.severity === "low").length,
  };
  let verdict: Verdict = "ready";
  if (counts.high > 0) verdict = "not_ready";
  else if (counts.medium > 0) verdict = "needs_work";

  const summary =
    verdict === "not_ready"
      ? `Документ лучше не отдавать в разработку: ${counts.high} замечаний высокой важности. Закройте high, затем medium.`
      : verdict === "needs_work"
        ? `Блокеров нет, но есть ${counts.medium} замечаний средней важности. Имеет смысл дописать ТЗ до передачи.`
        : counts.low > 0
          ? `Критичных дыр не видно. Остались низкие замечания — можно отдавать, если аналитик их принимает.`
          : "По текущим правилам обязательных дыр не найдено. Решение о передаче остаётся за аналитиком.";

  return {
    verdict,
    summary,
    findings: sorted,
    counts,
    model,
    usedLlm,
  };
}
