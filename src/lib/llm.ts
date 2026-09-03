import { parseDocument } from "./parse";
import type { Finding, ReviewResult, ReviewRole, Rule, Verdict } from "./types";
import { ROLE_LABELS } from "./types";

const FREE_MODEL = "qwen/qwen3.8-27b";
const FREE_BASE = "https://api.groq.com/openai/v1";

/** Groq free TPM is tight; disable thinking and keep each role prompt compact. */
const DOC_SLICE = 5500;
const ROLE_GAP_MS = 2500;
const MAX_TOKENS = 800;

type RolePass = {
  role: ReviewRole;
  title: string;
  focus: string;
  ruleIds: string[];
};

const ROLE_PASSES: RolePass[] = [
  {
    role: "template",
    title: "читатель шаблона ТЗ NET",
    focus:
      "Только покрытие шаблона «Потоковые данные/витрины»: пустые и отсутствующие разделы, нет «не применимо», нет Data Catalog, нет примера 10 строк, нет DDL. Историю изменений не смотри.",
    ruleIds: ["2", "5"],
  },
  {
    role: "developer",
    title: "разработчик потока и витрины NET",
    focus:
      "Глазами разработки: кластер Kafka, сериализация, ключ топика / партиция HDFS, путь хранения, джойны, инкремент vs полная перезагрузка, зерно, единицы времени, GROUP BY метрик, поля FAQ вне структуры.",
    ruleIds: ["1", "3", "6", "7"],
  },
  {
    role: "qa",
    title: "тестировщик витрин и потоков NET",
    focus:
      "Глазами QA: типовые фильтры, справочник не нашёл запись, пустой IMEI, абонент без lac/cell, SLA, объём, как грузить историю, что считать успехом прогона.",
    ruleIds: ["4", "8"],
  },
];

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function customRuleIds(rules: Rule[]): string[] {
  return rules.filter((r) => !/^[1-8]$/.test(r.id)).map((r) => r.id);
}

function compactRules(rules: Rule[], primaryIds: string[]): string {
  const primary = rules.filter((r) => primaryIds.includes(r.id));
  const rest = rules.filter((r) => !primaryIds.includes(r.id));
  const main = primary
    .map((r) => `${r.id}. ${r.title}: ${r.lookFor} Вопрос: ${r.askIfMissing}`)
    .join("\n");
  const other = rest.map((r) => `${r.id} ${r.title}`).join("; ");
  return other
    ? `${main}\nЕщё правила (не повторяй чужие находки): ${other}`
    : main;
}

function knownBlock(findings: Finding[]): string {
  if (!findings.length) return "нет";
  return findings
    .slice(0, 16)
    .map(
      (f) =>
        `${ROLE_LABELS[f.role]}#${f.ruleId ?? "-"} ${f.section}: ${f.ask.slice(0, 70)}`,
    )
    .join(" | ");
}

function sliceForRole(text: string, pass: RolePass, maxChars: number): string {
  const doc = parseDocument(text);
  const keys: Record<ReviewRole, string[]> = {
    template: [
      "каталог",
      "data catalog",
      "не применимо",
      "обогащен",
      "ddl",
      "пример",
      "шаблон",
      "раздел",
      "faq",
    ],
    developer: [
      "kafka",
      "кластер",
      "сериал",
      "hdfs",
      "путь",
      "nullable",
      "not null",
      "инкремент",
      "group",
      "партиц",
      "топик",
      "avro",
      "parquet",
      "ключ",
    ],
    qa: [
      "фильтр",
      "справочник",
      "словар",
      "sla",
      "объём",
      "объем",
      "задерж",
      "imei",
      "не найден",
      "история",
      "приёмк",
      "null",
    ],
  };
  const needles = keys[pass.role];
  const toc = doc.sections.map((s) => s.title).join(" | ");
  const parts: string[] = [`Разделы: ${toc}`];
  for (const section of doc.sections) {
    const hay = `${section.title}\n${section.text}`.toLowerCase();
    const relevant = needles.some((k) => hay.includes(k));
    const cap = relevant ? 1400 : 220;
    const body =
      section.text.length > cap ? `${section.text.slice(0, cap)}…` : section.text;
    const chunk = `\n## ${section.title}\n${body || "пусто"}`;
    if (parts.join("").length + chunk.length > maxChars) {
      const room = maxChars - parts.join("").length - 24;
      if (room > 80) {
        parts.push(
          `\n## ${section.title}\n${section.text.slice(0, room)}…`,
        );
      }
      break;
    }
    parts.push(chunk);
  }
  return parts.join("").slice(0, maxChars);
}

async function callRole(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  document: string;
  rules: Rule[];
  already: Finding[];
  pass: RolePass;
}): Promise<{ findings: Finding[]; ok: boolean }> {
  const prompt = `Роль: ${opts.pass.title}.
${opts.pass.focus}

Не исправляй ТЗ. Только место + почему + вопрос. Лучше лишняя придирка, чем пропуск.
Каждая находка — про ЭТОТ документ, с цитатой. Историю изменений не комментируй.
Не предлагай замену абзаца. Не повторяй уже найденное.

Твои правила:
${compactRules(opts.rules, opts.pass.ruleIds)}

Уже найдено:
${knownBlock(opts.already)}

Верни JSON:
{"findings":[{"severity":"high"|"medium"|"low","ruleId":"id из списка правил или нет","section":"","quote":"","why":"","ask":""}]}

ТЗ:
"""${sliceForRole(opts.document, opts.pass, DOC_SLICE)}"""`;

  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "SPEC-CHECK-PRO/1.0",
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        reasoning_effort: "none",
        reasoning_format: "hidden",
        messages: [
          {
            role: "system",
            content: `Ты ${opts.pass.title}. Отвечаешь только JSON. Русский язык. Без размышлений.`,
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) {
      const errText = await res.text().catch(() => "");
      lastError = errText;
      const retryHeader = res.headers.get("retry-after");
      const fromMsg = errText.match(/try again in ([\d.]+)\s*s/i);
      const sec = retryHeader
        ? Number(retryHeader)
        : fromMsg
          ? Number(fromMsg[1])
          : 4 * (attempt + 1);
      const wait = Math.ceil((Number.isFinite(sec) ? sec : 4) * 1000) + 1500;
      console.warn(`LLM ${opts.pass.role} rate-limited, retry in ${wait}ms`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`LLM ${opts.pass.role} failed`, res.status, errText.slice(0, 300));
      return { findings: [], ok: false };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    return {
      ok: true,
      findings: (parsed?.findings ?? []).map((f, i) => ({
        id: `llm-${opts.pass.role}-${i + 1}`,
        severity: f.severity ?? "medium",
        ruleId: f.ruleId,
        section: f.section || "Документ",
        quote: f.quote || "раздел отсутствует",
        why: f.why || "",
        ask: f.ask || "",
        role: opts.pass.role,
      })),
    };
  }

  console.warn(`LLM ${opts.pass.role} gave up after retries`, lastError.slice(0, 200));
  return { findings: [], ok: false };
}

export async function enrichWithQwen(
  document: string,
  rules: Rule[],
  seed: Finding[],
): Promise<{
  findings: Finding[];
  used: boolean;
  model: string;
  llmCalls: number;
  rolesRan: ReviewRole[];
}> {
  const groqKey = env("GROQ_API_KEY");
  const apiKey = groqKey ?? env("OPENAI_API_KEY") ?? env("DASHSCOPE_API_KEY");
  const baseUrl = env("OPENAI_BASE_URL") ?? FREE_BASE;
  const model = env("OPENAI_MODEL") ?? FREE_MODEL;

  if (!apiKey) {
    return { findings: seed, used: false, model, llmCalls: 0, rolesRan: [] };
  }

  let merged = [...seed];
  let okCalls = 0;
  const rolesRan: ReviewRole[] = [];
  const extraIds = customRuleIds(rules);

  try {
    for (let i = 0; i < ROLE_PASSES.length; i++) {
      const base = ROLE_PASSES[i]!;
      const pass =
        base.role === "template" && extraIds.length
          ? { ...base, ruleIds: [...base.ruleIds, ...extraIds] }
          : base;
      const { findings: extra, ok } = await callRole({
        apiKey,
        baseUrl,
        model,
        document,
        rules,
        already: merged,
        pass,
      });
      if (ok) {
        okCalls += 1;
        rolesRan.push(pass.role);
      }
      merged = mergeFindings(merged, extra);
      if (i < ROLE_PASSES.length - 1) await sleep(ROLE_GAP_MS);
    }
    return { findings: merged, used: okCalls > 0, model, llmCalls: okCalls, rolesRan };
  } catch (err) {
    console.warn("LLM request error", err);
    return { findings: merged, used: okCalls > 0, model, llmCalls: okCalls, rolesRan };
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
  llmCalls = 0,
  rolesRan: ReviewRole[] = [],
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

  let summary =
    verdict === "not_ready"
      ? `Документ лучше не отдавать в разработку: ${counts.high} замечаний высокой важности. Закройте high, затем medium.`
      : verdict === "needs_work"
        ? `Блокеров нет, но есть ${counts.medium} замечаний средней важности. Имеет смысл дописать ТЗ до передачи.`
        : counts.low > 0
          ? `Критичных дыр не видно. Остались низкие замечания — можно отдавать, если аналитик их принимает.`
          : "По текущим правилам обязательных дыр не найдено. Решение о передаче остаётся за аналитиком.";

  if (usedLlm && llmCalls < 3) {
    summary += ` Модель ответила в ${llmCalls} из 3 ролей.`;
  }

  return {
    verdict,
    summary,
    findings: sorted,
    counts,
    model,
    usedLlm,
    llmCalls,
    rolesRan,
  };
}
