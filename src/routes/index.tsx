import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { matchDoc } from "@/data";
import type { Block, CommentStatus, ReviewDoc } from "@/data/types";
import { DocumentPreview } from "@/components/DocumentPreview";
import { CommentsRail } from "@/components/CommentsRail";
import { downloadDocx, downloadPdf } from "@/lib/doc-export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ревью ТЗ — анализ технических заданий" },
      {
        name: "description",
        content:
          "Загрузите ТЗ в формате Word, PDF или текстом и получите документ с подсвеченными логическими ошибками и комментариями по критичности.",
      },
      { property: "og:title", content: "Ревью ТЗ — анализ технических заданий" },
      {
        property: "og:description",
        content:
          "Анализ технического задания: подсветка проблемных мест и комментарии трёх уровней критичности.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Stage = "input" | "loading" | "result";

function Index() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("input");
  const [doc, setDoc] = useState<ReviewDoc | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CommentStatus>>({});
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    if (!doc) return null;
    return {
      total: doc.comments.length,
      crit: doc.comments.filter((c) => c.severity === 3).length,
      warn: doc.comments.filter((c) => c.severity === 2).length,
      note: doc.comments.filter((c) => c.severity === 1).length,
    };
  }, [doc]);

  const rejectedIds = useMemo(
    () => new Set(Object.entries(statuses).filter(([, s]) => s === "rejected").map(([id]) => id)),
    [statuses],
  );

  const canSend = text.trim().length > 0 || !!fileName;

  function analyze() {
    if (!canSend) return;
    setStage("loading");
    const picked = matchDoc(`${fileName ?? ""} ${text}`);
    window.setTimeout(() => {
      setDoc(picked);
      setBlocks(picked.blocks.map((b) => ({ ...b })));
      setActiveId(null);
      setStatuses({});
      setEditing(false);
      setStage("result");
    }, 1600);
  }

  function setStatus(id: string, status: CommentStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function select(id: string) {
    setActiveId(id);
    document
      .getElementById(`comment-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(`mark-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reset() {
    setStage("input");
    setDoc(null);
    setActiveId(null);
    setEditing(false);
  }

  const open = stage === "result";

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      {/* Левая часть */}
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

        {/* Ввод */}
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
          </p>

          <div className="mt-10 rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-24px_rgba(0,0,0,0.4)] transition-colors focus-within:border-foreground/40">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Опишите контекст или вставьте текст ТЗ целиком…"
              rows={5}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {fileName && (
              <div className="mx-4 mb-2 inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[13px]">
                <FileText className="size-3.5" />
                <span className="max-w-[18rem] truncate">{fileName}</span>
                <button
                  onClick={() => setFileName(null)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Удалить файл"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between px-2 pb-1">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Paperclip className="size-4" />
                Прикрепить файл
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFileName(f.name);
                  e.target.value = "";
                }}
              />
              <button
                onClick={analyze}
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
      </div>

      {/* Боковая панель предпросмотра */}
      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col overflow-hidden border-l border-border bg-background transition-all duration-500 ease-out",
          open ? "sticky top-0 w-full lg:flex-1" : "w-0 border-l-0",
        )}
      >

        {doc && stats && (
          <>
            <div className="no-print flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
              <div className="mr-auto">
                <p className="text-sm font-semibold">{doc.title}</p>
                <p className="mt-0.5 flex items-center gap-3 text-[12px] text-muted-foreground">
                  <span>Замечаний: {stats.total}</span>
                  <span className="inline-flex items-center gap-1">
                    <i className="size-2 rounded-full bg-crit" />
                    {stats.crit}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="size-2 rounded-full bg-warn" />
                    {stats.warn}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="size-2 rounded-full bg-note" />
                    {stats.note}
                  </span>
                </p>
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
                onClick={() => downloadDocx(doc.title, blocks)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] transition-colors hover:border-foreground"
              >
                <Download className="size-3.5" />
                Word
              </button>
              <button
                onClick={downloadPdf}
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
                  title={doc.title}
                  blocks={blocks}
                  comments={doc.comments}
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
                  comments={doc.comments}
                  activeId={activeId}
                  statuses={statuses}
                  onSelect={select}
                  onStatus={setStatus}
                />
              </div>
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
