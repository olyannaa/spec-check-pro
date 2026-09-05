"use client";

import { CommentsRail } from "@/components/comments-rail";
import { DocumentPreview } from "@/components/document-preview";
import {
  commentsFromFindings,
  parseBlocks,
  type Block,
  type CommentStatus,
  type DocComment,
} from "@/lib/doc-view";
import { buildExportReport, fileStem } from "@/lib/export-report";
import { scrollDocumentTo } from "@/lib/scroll-doc";
import { blankRule, DEFAULT_RULES, nextRuleId } from "@/lib/rules";
import { ROLE_LABELS, type ReviewResult, type ReviewRole, type Rule } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Check,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Stage = "input" | "loading" | "result";

export default function SpecCheckApp() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("input");
  const [title, setTitle] = useState("Техническое задание");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [comments, setComments] = useState<DocComment[]>([]);
  const [summary, setSummary] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CommentStatus>>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<Rule[]>(DEFAULT_RULES);
  const [llmCalls, setLlmCalls] = useState(0);
  const [rolesRan, setRolesRan] = useState<ReviewRole[]>([]);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("speccheck-rules");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Rule[];
      if (parsed.length) {
        setRules(parsed);
        setDraftRules(parsed);
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  const stats = useMemo(() => {
    if (!comments.length) return null;
    return {
      total: comments.length,
      crit: comments.filter((c) => c.severity === 3).length,
      warn: comments.filter((c) => c.severity === 2).length,
      note: comments.filter((c) => c.severity === 1).length,
    };
  }, [comments]);

  const rejectedIds = useMemo(
    () =>
      new Set(
        Object.entries(statuses)
          .filter(([, s]) => s === "rejected")
          .map(([id]) => id),
      ),
    [statuses],
  );

  const canSend = text.trim().length > 0 || !!file;
  const open = stage === "result";
  const roleLine =
    llmCalls > 0
      ? `Модель: ${llmCalls} из 3 ролей${
          rolesRan.length
            ? ` (${rolesRan.map((r) => ROLE_LABELS[r]).join(" → ")})`
            : ""
        }`
      : null;

  async function analyze() {
    if (!text.trim() && !file) return;
    setStage("loading");
    setError(null);
    try {
      const form = new FormData();
      form.set("rules", JSON.stringify(rules));
      if (text.trim()) form.set("text", text);
      if (file) form.set("file", file);
      const res = await fetch("/api/review", { method: "POST", body: form });
      const data = (await res.json()) as ReviewResult & {
        error?: string;
        text?: string;
        fileName?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Не удалось разобрать документ.");
        setStage("input");
        return;
      }
      const body = data.text?.trim() || text.trim();
      const parsed = parseBlocks(body);
      setBlocks(parsed);
      setComments(commentsFromFindings(parsed, data.findings));
      setSummary(data.summary);
      setLlmCalls(data.llmCalls ?? 0);
      setRolesRan(data.rolesRan ?? []);
      setTitle(file?.name ?? "Техническое задание");
      setActiveId(null);
      setStatuses({});
      setEditing(false);
      setStage("result");
    } catch {
      setError("Сеть или сервер не ответили.");
      setStage("input");
    }
  }

  function select(id: string, from: "comment" | "mark" = "comment") {
    setActiveId(id);
    if (from !== "comment") return;
    requestAnimationFrame(() => {
      const comment = comments.find((c) => c.id === id);
      scrollDocumentTo(id, comment?.anchors[0]?.block);
    });
  }

  function reset() {
    setStage("input");
    setComments([]);
    setBlocks([]);
    setActiveId(null);
    setEditing(false);
    setRulesOpen(false);
    setLlmCalls(0);
    setRolesRan([]);
  }

  function saveRules() {
    const next = draftRules
      .map((r) => ({
        ...r,
        title: r.title.trim(),
        lookFor: r.lookFor.trim(),
        askIfMissing: r.askIfMissing.trim(),
      }))
      .filter((r) => r.title || r.lookFor);
    const stored = next.length ? next : DEFAULT_RULES;
    setRules(stored);
    setDraftRules(stored);
    localStorage.setItem("speccheck-rules", JSON.stringify(stored));
    setRulesOpen(false);
  }

  async function downloadExport(format: "docx" | "pdf") {
    if (exporting) return;
    setExporting(format);
    setError(null);
    try {
      const report = buildExportReport({
        title,
        summary,
        roleLine,
        blocks,
        comments,
        statuses,
      });
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, report }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Не удалось собрать файл.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileStem(title)}.${format === "pdf" ? "pdf" : "docx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скачать файл.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {!open ? (
        <>
          <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-destructive" />
              <span className="text-sm font-semibold tracking-tight">Ревью ТЗ</span>
            </div>
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              Анализ технических заданий
            </span>
          </header>

          <section className="mx-auto w-full max-w-3xl px-6 pb-16 pt-20">
            <h1 className="text-center text-4xl font-semibold tracking-tight text-balance">
              Проверим ваше ТЗ на логические ошибки
            </h1>
            <p className="mt-4 text-center text-[15px] text-muted-foreground text-balance">
              Прикрепите документ (Word или PDF) либо вставьте текст технического задания.
              Одна модель смотрит ТЗ тремя ролями: шаблон, разработчик и QA.
              Замечания — HIGH, MEDIUM и LOW. Текст сам не переписываю.
            </p>

            {error ? (
              <p className="mt-4 text-center text-sm text-destructive">{error}</p>
            ) : null}
            {stage === "loading" ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Три запроса одной модели: шаблон → разработчик → QA
              </p>
            ) : null}

            <div className="mt-10 rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-24px_rgba(0,0,0,0.4)]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Опишите контекст или вставьте текст ТЗ целиком…"
                rows={5}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {file ? (
                <div className="mx-4 mb-2 inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[13px]">
                  <FileText className="size-3.5" />
                  <span className="max-w-[18rem] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Удалить файл"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}

              {rulesOpen ? (
                <RulesEditor
                  draft={draftRules}
                  onChange={setDraftRules}
                  onCancel={() => setRulesOpen(false)}
                  onSave={saveRules}
                />
              ) : null}

              <div className="relative z-10 flex items-center justify-between gap-2 px-2 pb-1">
                <div className="flex flex-wrap items-center gap-1">
                  <label className="relative isolate inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <Paperclip className="pointer-events-none size-4" />
                    <span className="pointer-events-none">Прикрепить файл</span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.doc,.docx,application/pdf"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftRules(rules);
                      setRulesOpen((v) => !v);
                    }}
                    className="relative z-10 inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Shield className="size-4" />
                    Правила проверки
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {rules.length}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void analyze()}
                  disabled={!canSend || stage === "loading"}
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full transition-all",
                    canSend
                      ? "bg-destructive text-destructive-foreground hover:opacity-90"
                      : "bg-secondary text-muted-foreground",
                  )}
                  aria-label="Отправить на анализ"
                >
                  {stage === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex min-h-screen">
          <div className="hidden min-w-0 lg:block lg:max-w-[34rem] lg:flex-none lg:border-r lg:border-border">
            <header className="flex h-14 items-center gap-2 border-b border-border px-6">
              <span className="size-2.5 rounded-full bg-destructive" />
              <span className="text-sm font-semibold tracking-tight">Ревью ТЗ</span>
            </header>
            <section className="px-6 py-10">
              <p className="text-lg font-semibold">Новая проверка</p>
              <button
                type="button"
                onClick={reset}
                className="mt-4 rounded-lg border border-border px-3 py-2 text-sm hover:border-foreground"
              >
                Загрузить другое ТЗ
              </button>
            </section>
          </div>

          <section className="flex min-h-screen min-w-0 flex-1 flex-col">
            {stats ? (
              <>
                <div className="no-print flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
                  <div className="mr-auto min-w-0">
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                      <span>Замечаний: {stats.total}</span>
                      <span className="inline-flex items-center gap-1">
                        <i className="size-2 rounded-full bg-crit" />
                        HIGH {stats.crit}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <i className="size-2 rounded-full bg-warn" />
                        MEDIUM {stats.warn}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <i className="size-2 rounded-full bg-note" />
                        LOW {stats.note}
                      </span>
                      {roleLine ? <span>{roleLine}</span> : null}
                    </p>
                    {summary ? (
                      <p className="mt-1 max-w-xl text-[12px] text-muted-foreground">
                        {summary}
                      </p>
                    ) : null}
                    {error ? (
                      <p className="mt-1 text-[12px] text-destructive">{error}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors",
                      editing
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-border hover:border-foreground",
                    )}
                  >
                    {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
                    {editing ? "Готово" : "Исправить текст"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadExport("docx")}
                    disabled={!!exporting}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] hover:border-foreground disabled:opacity-50"
                  >
                    {exporting === "docx" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    Word
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadExport("pdf")}
                    disabled={!!exporting}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] hover:border-foreground disabled:opacity-50"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-foreground"
                    aria-label="Закрыть"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="print-area flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                  <div id="doc-scroll" className="min-w-0 flex-1 overflow-y-auto">
                    <DocumentPreview
                      title={title}
                      blocks={blocks}
                      comments={comments}
                      activeId={activeId}
                      rejectedIds={rejectedIds}
                      onSelect={(id) => select(id, "mark")}
                      editing={editing}
                      onEdit={(i, next) =>
                        setBlocks((prev) => prev.map((b, bi) => (bi === i ? next : b)))
                      }
                    />
                  </div>
                  <div
                    id="comments-scroll"
                    className="no-print no-scroll-anchor relative z-20 max-h-[42vh] shrink-0 overflow-y-auto border-t border-border bg-secondary/30 p-4 lg:h-full lg:max-h-none lg:w-[24rem] lg:border-l lg:border-t-0"
                  >
                    <p className="mb-3 px-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                      Комментарии
                    </p>
                    <CommentsRail
                      comments={comments}
                      activeId={activeId}
                      statuses={statuses}
                      onSelect={(id) => select(id, "comment")}
                      onStatus={(id, status) =>
                        setStatuses((prev) => ({ ...prev, [id]: status }))
                      }
                    />
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}

function rulesCountLabel(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} правило`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} правила`;
  return `${n} правил`;
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  function patch(id: string, field: keyof Rule, value: string) {
    onChange(draft.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function addRule() {
    onChange([...draft, blankRule(nextRuleId(draft))]);
    requestAnimationFrame(() => {
      const node = scrollerRef.current;
      node?.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    });
  }
  function removeRule(id: string) {
    onChange(draft.filter((r) => r.id !== id));
  }
  return (
    <div
      ref={scrollerRef}
      className="relative z-10 mx-2 mb-3 max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-secondary/40 p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Правила проверки
          <span className="ml-2 font-normal text-muted-foreground">
            {rulesCountLabel(draft.length)}
          </span>
        </p>
        <button type="button" onClick={onCancel} className="text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-2">
        {draft.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Правил нет. Добавьте своё или верните обязательные восемь.
          </p>
        ) : null}
        {draft.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] text-muted-foreground">
                Правило {rule.id}
              </p>
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
                aria-label={`Удалить правило ${rule.id}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <input
              value={rule.title}
              onChange={(e) => patch(rule.id, "title", e.target.value)}
              placeholder="Название правила"
              className="mb-1 w-full rounded-md border border-border px-2 py-1 text-sm outline-none"
            />
            <textarea
              value={rule.lookFor}
              onChange={(e) => patch(rule.id, "lookFor", e.target.value)}
              placeholder="Что искать в ТЗ"
              rows={2}
              className="mb-1 w-full rounded-md border border-border px-2 py-1 text-[12px] outline-none"
            />
            <textarea
              value={rule.askIfMissing}
              onChange={(e) => patch(rule.id, "askIfMissing", e.target.value)}
              placeholder="Какой вопрос задать, если этого нет"
              rows={2}
              className="w-full rounded-md border border-border px-2 py-1 text-[12px] outline-none"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addRule}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-4" />
          Добавить правило
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange(DEFAULT_RULES)}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Вернуть 8 обязательных
        </button>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-2 py-1 text-sm text-muted-foreground">
            Отмена
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
