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
import { DEFAULT_RULES } from "@/lib/rules";
import { SAMPLE_DOCS } from "@/lib/sample-meta";
import type { ReviewResult, Rule } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Check,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Stage = "input" | "loading" | "result";

export default function SpecCheckApp() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("input");
  const [title, setTitle] = useState("Техническое задание");
  const [sourceText, setSourceText] = useState("");
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
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function analyze(override?: { text?: string; file?: File | null; title?: string }) {
    const nextText = override?.text ?? text;
    const nextFile = override?.file === undefined ? file : override.file;
    if (!nextText.trim() && !nextFile) return;
    setStage("loading");
    setError(null);
    try {
      const form = new FormData();
      form.set("rules", JSON.stringify(rules));
      if (nextText.trim()) form.set("text", nextText);
      if (nextFile) form.set("file", nextFile);
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
      const body = data.text?.trim() || nextText.trim();
      const parsed = parseBlocks(body);
      setSourceText(body);
      setBlocks(parsed);
      setComments(commentsFromFindings(parsed, data.findings));
      setSummary(data.summary);
      setTitle(override?.title ?? nextFile?.name ?? "Техническое задание");
      setActiveId(null);
      setStatuses({});
      setEditing(false);
      setStage("result");
    } catch {
      setError("Сеть или сервер не ответили.");
      setStage("input");
    }
  }

  async function loadSample(id: string, sampleTitle: string) {
    const res = await fetch(`/api/samples?id=${id}`);
    const data = (await res.json()) as { text?: string };
    if (!data.text) return;
    setText(data.text);
    setFile(null);
    await analyze({ text: data.text, file: null, title: sampleTitle });
  }

  function select(id: string) {
    setActiveId(id);
    document
      .getElementById(`comment-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    document
      .getElementById(`mark-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reset() {
    setStage("input");
    setComments([]);
    setBlocks([]);
    setActiveId(null);
    setEditing(false);
    setRulesOpen(false);
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
  }

  function downloadMd() {
    const blob = new Blob([sourceText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <div
        className={cn(
          "min-w-0 flex-1 transition-all duration-500 ease-out",
          open && "hidden lg:block lg:max-w-[34rem]",
        )}
      >
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-destructive" />
            <span className="text-sm font-semibold tracking-tight">Ревью ТЗ</span>
          </div>
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Анализ технических заданий
          </span>
        </header>

        <section
          className={cn(
            "no-print mx-auto w-full max-w-3xl px-6 pb-16",
            open ? "pt-10" : "pt-20",
          )}
        >
          <h1
            className={cn(
              "text-center font-semibold tracking-tight text-balance",
              open ? "text-2xl" : "text-4xl",
            )}
          >
            Проверим ваше ТЗ на логические ошибки
          </h1>
          <p className="mt-4 text-center text-[15px] text-muted-foreground text-balance">
            Прикрепите документ (Word или PDF) либо вставьте текст технического задания.
            Замечания — HIGH, MEDIUM и LOW. Текст сам не переписываю.
          </p>

          {error ? (
            <p className="mt-4 text-center text-sm text-destructive">{error}</p>
          ) : null}

          <div className="mt-10 rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-24px_rgba(0,0,0,0.4)] transition-colors focus-within:border-foreground/40">
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

            <div className="flex items-center justify-between gap-2 px-2 pb-1">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Paperclip className="size-4" />
                  Прикрепить файл
                </button>
                <button
                  onClick={() => {
                    setDraftRules(rules);
                    setRulesOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Shield className="size-4" />
                  Обновить 8 обязательных правил
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                  e.target.value = "";
                }}
              />
              <button
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

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SAMPLE_DOCS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void loadSample(s.id, s.title)}
                className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                {s.title}
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col overflow-hidden border-l border-border bg-background transition-all duration-500 ease-out",
          open ? "sticky top-0 w-full lg:flex-1" : "w-0 border-l-0",
        )}
      >
        {open && stats ? (
          <>
            <div className="no-print flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
              <div className="mr-auto min-w-0">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className="mt-0.5 flex items-center gap-3 text-[12px] text-muted-foreground">
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
                </p>
                {summary ? (
                  <p className="mt-1 max-w-xl text-[12px] text-muted-foreground">
                    {summary}
                  </p>
                ) : null}
              </div>
              <button
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
                onClick={downloadMd}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] transition-colors hover:border-foreground"
              >
                <Download className="size-3.5" />
                Word
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] transition-colors hover:border-foreground"
              >
                <Download className="size-3.5" />
                PDF
              </button>
              <button
                onClick={reset}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border transition-colors hover:border-foreground"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="print-area flex min-h-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-y-auto">
                <DocumentPreview
                  title={title}
                  blocks={blocks}
                  comments={comments}
                  activeId={activeId}
                  rejectedIds={rejectedIds}
                  onSelect={select}
                  editing={editing}
                  onEdit={(i, next) =>
                    setBlocks((prev) => prev.map((b, bi) => (bi === i ? next : b)))
                  }
                />
              </div>
              <div className="no-print hidden w-[24rem] shrink-0 overflow-y-auto border-l border-border bg-secondary/30 p-4 lg:block">
                <p className="mb-3 px-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  Комментарии
                </p>
                <CommentsRail
                  comments={comments}
                  activeId={activeId}
                  statuses={statuses}
                  onSelect={select}
                  onStatus={(id, status) =>
                    setStatuses((prev) => ({ ...prev, [id]: status }))
                  }
                />
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </main>
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
    <div className="mx-2 mb-3 max-h-72 overflow-y-auto rounded-xl border border-border bg-secondary/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">8 обязательных правил</p>
        <button type="button" onClick={onCancel} className="text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-2">
        {draft.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-border bg-background p-2">
            <p className="mb-1 font-mono text-[10px] text-muted-foreground">
              Правило {rule.id}
            </p>
            <input
              value={rule.title}
              onChange={(e) => patch(rule.id, "title", e.target.value)}
              className="mb-1 w-full rounded-md border border-border px-2 py-1 text-sm outline-none"
            />
            <textarea
              value={rule.lookFor}
              onChange={(e) => patch(rule.id, "lookFor", e.target.value)}
              rows={2}
              className="mb-1 w-full rounded-md border border-border px-2 py-1 text-[12px] outline-none"
            />
            <textarea
              value={rule.askIfMissing}
              onChange={(e) => patch(rule.id, "askIfMissing", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-2 py-1 text-[12px] outline-none"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
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
  );
}
