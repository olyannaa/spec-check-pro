"use client";

import { FindingCard } from "@/components/finding-card";
import { DEFAULT_RULES } from "@/lib/rules";
import { SAMPLE_DOCS } from "@/lib/sample-meta";
import type { ChatMessage, ReviewResult, Rule } from "@/lib/types";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Загрузите готовое ТЗ — PDF или текст. Проверю по 8 обязательным правилам и укажу места, которые стоит уточнить до разработки. Текст сам не исправляю.\n\nВажность каждого замечания: HIGH, MEDIUM или LOW. Модель: Qwen.",
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function SpecCheckApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<Rule[]>(DEFAULT_RULES);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("speccheck-rules");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Rule[];
        if (parsed.length) {
          setRules(parsed);
          setDraftRules(parsed);
        }
      } catch {
        /* keep defaults */
      }
    }
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, rulesOpen, busy]);

  async function runReview(payload: {
    text?: string;
    file?: File | null;
    label: string;
  }) {
    setBusy(true);
    setMessages((m) => [
      ...m,
      {
        id: uid(),
        role: "user",
        text: payload.text,
        fileName: payload.file?.name ?? (payload.text ? undefined : payload.label),
      },
    ]);
    try {
      const form = new FormData();
      form.set("rules", JSON.stringify(rules));
      if (payload.text) form.set("text", payload.text);
      if (payload.file) form.set("file", payload.file);
      const res = await fetch("/api/review", { method: "POST", body: form });
      const data = (await res.json()) as ReviewResult & { error?: string };
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            text: data.error ?? "Не удалось разобрать документ.",
          },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: data.summary,
          review: data,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: "Сеть или сервер не ответили. Повторите проверку.",
        },
      ]);
    } finally {
      setBusy(false);
      setInput("");
      setFile(null);
    }
  }

  async function send() {
    if (busy) return;
    if (!input.trim() && !file) return;
    await runReview({
      text: input.trim() || undefined,
      file,
      label: "ТЗ",
    });
  }

  async function loadSample(id: string, title: string) {
    if (busy) return;
    const res = await fetch(`/api/samples?id=${id}`);
    const data = (await res.json()) as { text?: string; error?: string };
    if (!data.text) return;
    await runReview({ text: data.text, label: title });
  }

  function openRules() {
    setDraftRules(rules);
    setRulesOpen(true);
  }

  function saveRules() {
    const next = draftRules.map((r) => ({
      ...r,
      title: r.title.trim(),
      lookFor: r.lookFor.trim(),
      askIfMissing: r.askIfMissing.trim(),
    }));
    setRules(next);
    localStorage.setItem("speccheck-rules", JSON.stringify(next));
    setRulesOpen(false);
    setMessages((m) => [
      ...m,
      {
        id: uid(),
        role: "assistant",
        rulesUpdated: true,
        text: "8 обязательных правил обновлены. Следующая проверка ТЗ пойдёт уже по новой версии. Историю изменений документа по-прежнему не ревьюим.",
      },
    ]);
  }

  return (
    <div className="flex h-full min-h-0 bg-bg">
      <aside className="hidden w-[272px] shrink-0 flex-col bg-sidebar text-[#f3ece3] md:flex">
        <div className="px-5 pb-4 pt-6">
          <p className="font-mono text-[11px] tracking-[0.18em] text-[#c4b8a6]">
            NET / SPECCHECK
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">Ревизор ТЗ</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#b7ab9c]">
            Предварительное ревью потоков и витрин. Qwen, 8 правил, без автоисправления.
          </p>
        </div>
        <div className="px-3">
          <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-widest text-[#8a7f71]">
            Примеры
          </p>
          {SAMPLE_DOCS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => loadSample(s.id, s.title)}
              className="mb-1 flex w-full flex-col rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
            >
              <span className="text-sm">{s.title}</span>
              <span className="font-mono text-[11px] text-[#8a7f71]">{s.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto border-t border-white/8 px-5 py-4 text-[12px] leading-relaxed text-[#8a7f71]">
          Проверка после написания. Решение о готовности — за аналитиком.
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-bg-chat">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:px-6">
          <div>
            <p className="text-sm font-semibold">Проверка документа</p>
            <p className="text-[12px] text-muted">
              Модель Qwen · {rules.length} обязательных правил
            </p>
          </div>
          <button
            type="button"
            onClick={openRules}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium hover:border-[#cbbfaa]"
          >
            <Shield className="h-3.5 w-3.5 text-accent" />
            8 правил
          </button>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-8">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Смотрю шаблон, 8 правил и формулировки…
            </div>
          ) : null}
        </div>

        <div className="border-t border-line bg-[#f7f2e9] px-3 py-3 md:px-6">
          {rulesOpen ? (
            <RulesEditor
              draft={draftRules}
              onChange={setDraftRules}
              onCancel={() => setRulesOpen(false)}
              onSave={saveRules}
            />
          ) : null}

          {file ? (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-accent" />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="ml-auto text-muted hover:text-ink"
                onClick={() => setFile(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-[#fffdf8]"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Приложить PDF
            </button>
            <button
              type="button"
              onClick={openRules}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0d5c56]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Обновить 8 обязательных правил
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-[0_8px_30px_rgba(28,25,21,0.04)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              placeholder="Вставьте текст ТЗ или приложите PDF и нажмите Проверить"
              className="max-h-40 min-h-[72px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#a39888]"
            />
            <button
              type="button"
              disabled={busy || (!input.trim() && !file)}
              onClick={() => void send()}
              className="mb-1 mr-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white disabled:opacity-30"
              aria-label="Проверить"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="px-1 pt-2 text-[11px] text-muted">
            Enter — проверить · Shift+Enter — новая строка
          </p>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[720px] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-sm leading-relaxed text-[#f7f2e9]">
        {message.fileName ? (
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-[#cbbfaa]">
            <FileText className="h-3.5 w-3.5" />
            {message.fileName}
          </p>
        ) : null}
        {message.text ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[13px]">
            {message.text.slice(0, 1200)}
            {message.text.length > 1200 ? "…" : ""}
          </pre>
        ) : null}
      </div>
    );
  }

  const review = message.review;
  return (
    <div className="max-w-[760px]">
      {message.rulesUpdated ? (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#e7f3f1] px-2.5 py-1 text-[11px] font-medium text-accent">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Правила обновлены
        </p>
      ) : null}
      {message.text ? (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {message.text}
        </p>
      ) : null}
      {review ? <ReviewBlock review={review} /> : null}
    </div>
  );
}

function ReviewBlock({ review }: { review: ReviewResult }) {
  const verdictLabel =
    review.verdict === "not_ready"
      ? "Не готов к разработке"
      : review.verdict === "needs_work"
        ? "Нужна доработка"
        : "Можно передавать";
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full bg-ink px-2.5 py-1 font-medium text-white">
          {verdictLabel}
        </span>
        <span className="rounded-full bg-[#fcebea] px-2.5 py-1 font-mono text-[#b42318]">
          HIGH {review.counts.high}
        </span>
        <span className="rounded-full bg-[#fef3e2] px-2.5 py-1 font-mono text-[#b45309]">
          MEDIUM {review.counts.medium}
        </span>
        <span className="rounded-full bg-[#f1eee8] px-2.5 py-1 font-mono text-[#57534e]">
          LOW {review.counts.low}
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-muted">
          {review.usedLlm ? "Qwen + правила" : "правила и эвристики"}
        </span>
      </div>
      {review.findings.map((f, i) => (
        <FindingCard key={f.id} finding={f} index={i} />
      ))}
    </div>
  );
}

function RulesEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Rule[];
  onChange: (rules: Rule[]) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  function patch(id: string, field: keyof Rule, value: string) {
    onChange(draft.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  return (
    <div className="mb-3 max-h-[46vh] overflow-y-auto rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Обновить 8 обязательных правил</p>
          <p className="text-[12px] text-muted">
            Правки попадут в следующую проверку. Не пропадают после перезагрузки.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {draft.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-line p-3">
            <p className="mb-2 font-mono text-[11px] text-muted">Правило {rule.id}</p>
            <input
              value={rule.title}
              onChange={(e) => patch(rule.id, "title", e.target.value)}
              className="mb-2 w-full rounded-lg border border-line px-2 py-1.5 text-sm"
            />
            <textarea
              value={rule.lookFor}
              onChange={(e) => patch(rule.id, "lookFor", e.target.value)}
              rows={2}
              className="mb-2 w-full rounded-lg border border-line px-2 py-1.5 text-[13px]"
            />
            <textarea
              value={rule.askIfMissing}
              onChange={(e) => patch(rule.id, "askIfMissing", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line px-2 py-1.5 text-[13px]"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-1.5 text-sm text-muted"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          Сохранить правила
        </button>
      </div>
    </div>
  );
}
